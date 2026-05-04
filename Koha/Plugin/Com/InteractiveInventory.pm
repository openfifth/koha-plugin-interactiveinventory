package Koha::Plugin::Com::InteractiveInventory;
use Modern::Perl;
use utf8;
## Required for all plugins
use base qw(Koha::Plugins::Base);
## We will also need to include any Koha libraries we want to access
use C4::Context;
use C4::Auth;
use DBI;
use CGI;
use JSON;
use URI::Escape;
use C4::Auth   qw( get_template_and_user );
use C4::Output qw( output_html_with_http_headers );
use C4::Items  qw( GetItemsForInventory );
use Koha::Items;
use Koha::Checkouts;
use Koha::ItemTypes;

our $VERSION = '1.4.2';

our $metadata = {
    name            => 'Interactive Inventory',
    author          => 'Jacob O\'Mara',
    date_authored   => '2024-06-12',
    date_updated    => "2025-03-24",
    minimum_version => '21.11.00.000',
    maximum_version => undef,
    version         => $VERSION,
    description     => 'Interactive Inventory plugin for Koha.',
};

sub new {
    my ( $class, $args ) = @_;

    $args->{'metadata'} = $metadata;
    $args->{'metadata'}->{'class'} = $class;

    my $self = $class->SUPER::new($args);

    return $self;
}

sub tool {
    my ( $self, $args ) = @_;
    my $cgi = $self->{cgi};

    # Route based on action parameter to handle custom methods
    # This allows users with only 'plugins.tool' permission to access all tool functionality
    my $action = $cgi->param('action') || '';

    if ( $action eq 'start_session' ) {
        return $self->start_session($args);
    }

    # Default: render the main tool template
    # Get template using get_template() method
    my $template = $self->get_template({ file => 'InteractiveInventory.tt' });

    my @class_sources = Koha::ClassSources->search( { used => 1 } )->as_list;
    my $pref_class    = C4::Context->preference("DefaultClassificationSource");

    # Pass @class_sources to the template
    $template->param(
        class_sources => \@class_sources,
        pref_class    => $pref_class,
    );

    # Output the template
    $self->output_html( $template->output() );
}

sub get_item_data {
    my ( $self, $args ) = @_;

    # Create a new CGI object
    my $cgi = CGI->new;

    # Get the 'barcode' parameter from the query string
    my $barcode = $cgi->param('barcode');

    # Check if barcode is defined
    unless ( defined $barcode ) {
        print $cgi->header( 'application/json', '500 Internal Server Error' );
        print encode_json( { error => 'Barcode parameter is missing' } );
        return;
    }

   # Process the barcode (e.g., look up item data in the database)
   # For demonstration, let's assume we have a function `lookup_item_by_barcode`
    my $item_data = lookup_item_by_barcode($barcode);

    # Return the item data as a JSON response
    print $cgi->header('application/json');
    print encode_json($item_data);
}

sub lookup_item_by_barcode {
    my ($barcode) = @_;
    my $item = Koha::Items->find( { barcode => $barcode } );

    return unless $item;

    return $item->unblessed;
}

sub start_session {
    my ( $self, $args ) = @_;

    my $cgi = $self->{cgi};
    print $cgi->header('application/json');

    eval {
        my $session_data_encoded = $cgi->param('session_data');
        
        unless (defined $session_data_encoded) {
            die "Missing session_data parameter";
        }
        
        my $session_data_json = uri_unescape($session_data_encoded);
        
        # Validate JSON before parsing
        my $session_data;
        eval {
            $session_data = decode_json($session_data_json);
        };
        if ($@) {
            die "Invalid JSON in session_data: $@";
        }
        
        # Validate required session data
        unless ($session_data && ref($session_data) eq 'HASH') {
            die "Session data must be a valid object";
        }
        
        my @itemtypes = Koha::ItemTypes->search->as_list;
        my @itemtype_codes = map { $_->itemtype } @itemtypes;

        # Quote each item type manually
        my @quoted_itemtypes = map { "'$_'" } @itemtype_codes;

        # Extract and validate session parameters with defaults
        my $minLocation = $session_data->{'minLocation'} || '';
        my $maxLocation = $session_data->{'maxLocation'} || '';
        $maxLocation = $minLocation.'Z' unless ($maxLocation || !$minLocation);
        my $locationLoop = $session_data->{'locationLoop'} || '';
        my $branchLoop = $session_data->{'branchLoop'} || '';
        my $dateLastSeen = $session_data->{'dateLastSeen'} || '';
        my $ccode = $session_data->{'ccode'} || '';
        my $classSource = $session_data->{'classSource'} || '';
        my $selectedStatuses = $session_data->{'selectedStatuses'} || {};
        my $ignoreIssued = $session_data->{'ignoreIssued'} || 0;
        my $ignoreWaitingHolds = $session_data->{'ignoreWaitingHolds'} || 0;
        my $skipCheckedOutItems = $session_data->{'skipCheckedOutItems'} || 0;
        my $skipInTransitItems = $session_data->{'skipInTransitItems'} || 0;
        my $skipBranchMismatchItems = $session_data->{'skipBranchMismatchItems'} || 0;
        my $compareBarcodes = $session_data->{'compareBarcodes'} || 0;
        
        if ($skipCheckedOutItems) {
            $ignoreIssued = 1;
        }
        
        # Ensure selectedItypes is an array
        my @selectedItypes;
        if (defined $session_data->{'selectedItypes'} && ref($session_data->{'selectedItypes'}) eq 'ARRAY') {
            @selectedItypes = map { "'$_'" } @{ $session_data->{'selectedItypes'} };
        }
        
        my $selectedbranchcode = $session_data->{'selectedLibraryId'} || '';
        my $shelvingLocation = $session_data->{'shelvingLocation'} || '';

        # Build common parameters for both queries
        my $common_params = {
            minlocation  => $minLocation,
            maxlocation  => $maxLocation,
            branch       => 'homebranch',
            branchcode   => $selectedbranchcode,
            ccode        => $ccode,
        };

        # If shelving location is set, use it as the location parameter
        if ($shelvingLocation) {
            $common_params->{location} = $shelvingLocation;
        } elsif ($locationLoop) {
            $common_params->{location} = $locationLoop;
        }

        # Only generate right_place_list if compareBarcodes is enabled
        my $rightPlaceList = [];
        if ($compareBarcodes) {
            ($rightPlaceList) = GetItemsForInventory($common_params);
        }

        # Ensure rightPlaceList is an array reference, even if empty
        $rightPlaceList = [] unless defined $rightPlaceList;

        # Enrich items with holdingbranch/in_transit/checked_out and apply skip filters
        $rightPlaceList = _enrich_and_filter_items($rightPlaceList, $skipInTransitItems, $skipBranchMismatchItems);

        # Build parameters for location data query
        my $location_params = {
            %$common_params,  # Include common parameters
            class_source        => $classSource,
            ignoreissued        => $ignoreIssued,
            datelastseen        => $dateLastSeen,
            branchcode          => $selectedbranchcode,
            offset              => 0,
            statushash          => $selectedStatuses,
            ignore_waiting_holds=> $ignoreWaitingHolds,
            itemtypes           => \@selectedItypes,
        };
        
        my ($location_data, $iTotalRecords) = GetItemsForInventory($location_params);

        # Ensure location_data is an array reference, even if empty
        $location_data = [] unless defined $location_data;

        # Enrich items with holdingbranch/in_transit/checked_out and apply skip filters
        $location_data = _enrich_and_filter_items($location_data, $skipInTransitItems, $skipBranchMismatchItems);

        # Modify the keys in location_data to conform to the required format
        foreach my $item (@$location_data) {
            foreach my $key (keys %$item) {
                my $new_key = $key;
                $new_key =~ s/[^a-zA-Z0-9_-]/_/g;  # Replace invalid characters with underscores
                $new_key = lcfirst($new_key);       # Ensure it starts with a lowercase letter
                if ($new_key ne $key) {
                    $item->{$new_key} = delete $item->{$key};
                }
            }
        }
        
        # Do the same for rightPlaceList
        foreach my $item (@$rightPlaceList) {
            foreach my $key (keys %$item) {
                my $new_key = $key;
                $new_key =~ s/[^a-zA-Z0-9_-]/_/g;  # Replace invalid characters with underscores
                $new_key = lcfirst($new_key);       # Ensure it starts with a lowercase letter
                if ($new_key ne $key) {
                    $item->{$new_key} = delete $item->{$key};
                }
            }
        }

        my $response = {
            location_data => $location_data,
            total_records => $iTotalRecords,
            right_place_list => $rightPlaceList,
        };

        # Return the JSON response
        print encode_json($response);
    };
    
    # Handle any errors that occurred during processing
    if ($@) {
        warn "Error in start_session: $@";
        print encode_json({ 
            error => "Error processing request: $@",
            success => 0
        });
    }
}

sub _enrich_and_filter_items {
    my ($items, $skipInTransitItems, $skipBranchMismatchItems) = @_;

    return [] unless $items && @$items;

    # Batch-enrich all items in a single query instead of N individual lookups.
    # Gets holdingbranch, in_transit, and checked_out for all items at once.
    my @itemnumbers = map { $_->{itemnumber} } @$items;
    if (@itemnumbers) {
        my $dbh = C4::Context->dbh;
        my $placeholders = join(',', ('?') x scalar @itemnumbers);
        my $sql = qq{
            SELECT i.itemnumber, i.holdingbranch,
                   CASE WHEN bt.branchtransfer_id IS NOT NULL THEN 1 ELSE 0 END AS in_transit,
                   CASE WHEN iss.issue_id IS NOT NULL THEN 1 ELSE 0 END AS checked_out
            FROM items i
            LEFT JOIN branchtransfers bt ON i.itemnumber = bt.itemnumber
                AND bt.datearrived IS NULL
                AND bt.datecancelled IS NULL
                AND bt.datesent IS NOT NULL
            LEFT JOIN issues iss ON i.itemnumber = iss.itemnumber
            WHERE i.itemnumber IN ($placeholders)
        };
        my $enrichment = $dbh->selectall_hashref($sql, 'itemnumber', undef, @itemnumbers);

        foreach my $item_hash (@$items) {
            my $extra = $enrichment->{ $item_hash->{itemnumber} } || {};
            $item_hash->{holdingbranch} = $extra->{holdingbranch} if defined $extra->{holdingbranch};
            $item_hash->{in_transit}    = $extra->{in_transit}    || 0;
            $item_hash->{checked_out}   = $extra->{checked_out}   || 0;
        }
    }

    # Apply server-side filtering for skip settings
    if ($skipInTransitItems) {
        $items = [ grep { !$_->{in_transit} } @$items ];
    }

    if ($skipBranchMismatchItems) {
        $items = [ grep {
            !defined $_->{holdingbranch} || !defined $_->{homebranch}
            || $_->{holdingbranch} eq $_->{homebranch}
        } @$items ];
    }

    return $items;
}

=head3

=cut

sub install {
    my ( $self, $args ) = @_;

    # Ensure the FOUND:INVENTORY authorized value exists in RETURN_CLAIM_RESOLUTION.
    # Without this value, resolving return claims with "FOUND:INVENTORY" will cause
    # the Return Claims tab on patron accounts to fail to load.
    my $dbh = C4::Context->dbh;
    my $exists = $dbh->selectrow_array(
        "SELECT COUNT(*) FROM authorised_values WHERE category = ? AND authorised_value = ?",
        undef, 'RETURN_CLAIM_RESOLUTION', 'FOUND:INVENTORY'
    );
    unless ($exists) {
        $dbh->do(
            "INSERT INTO authorised_values (category, authorised_value, lib) VALUES (?, ?, ?)",
            undef, 'RETURN_CLAIM_RESOLUTION', 'FOUND:INVENTORY', 'Found during inventory'
        );
    }

    return 1;
}

=head3 static_routes

=cut

sub static_routes {
    my ( $self, $args ) = @_;

    my $spec_str = $self->mbf_read('api/staticapi.json');
    my $spec     = decode_json($spec_str);

    return $spec;
}

=head3 api_namespace

=cut

sub api_namespace {
    my ($self) = @_;

    return 'interactiveinventory';
}

sub api_routes {
    my ($self) = @_;

    my $spec_str = $self->mbf_read('api/openapi.json');
    my $spec     = decode_json($spec_str);

    return $spec;
}

1;
