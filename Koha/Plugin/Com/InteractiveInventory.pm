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
use C4::Auth        qw( get_template_and_user );
use C4::Output      qw( output_html_with_http_headers );
use C4::ClassSource qw( GetClassSort );
use Koha::AuthorisedValues;
use Koha::Items;
use Koha::Checkouts;
use Koha::Holds;
use Koha::Item::Transfers;
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

    if ( $action eq 'get_inventory_page' ) {
        return $self->get_inventory_page($args);
    }

    # Default: render the main tool template
    # Get template using get_template() method
    my $template = $self->get_template( { file => 'InteractiveInventory.tt' } );

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

        unless ( defined $session_data_encoded ) {
            die "Missing session_data parameter";
        }

        my $session_data_json = uri_unescape($session_data_encoded);

        # Validate JSON before parsing
        my $session_data;
        eval { $session_data = decode_json($session_data_json); };
        if ($@) {
            die "Invalid JSON in session_data: $@";
        }

        # Validate required session data
        unless ( $session_data && ref($session_data) eq 'HASH' ) {
            die "Session data must be a valid object";
        }

        my @itemtypes      = Koha::ItemTypes->search->as_list;
        my @itemtype_codes = map { $_->itemtype } @itemtypes;

        # Quote each item type manually
        my @quoted_itemtypes = map { "'$_'" } @itemtype_codes;

        # Extract and validate session parameters with defaults
        my $minLocation = $session_data->{'minLocation'} || '';
        my $maxLocation = $session_data->{'maxLocation'} || '';
        $maxLocation = $minLocation . 'Z' unless ( $maxLocation || !$minLocation );
        my $locationLoop            = $session_data->{'locationLoop'}            || '';
        my $branchLoop              = $session_data->{'branchLoop'}              || '';
        my $dateLastSeen            = $session_data->{'dateLastSeen'}            || '';
        my $ccode                   = $session_data->{'ccode'}                   || '';
        my $classSource             = $session_data->{'classSource'}             || '';
        my $selectedStatuses        = $session_data->{'selectedStatuses'}        || {};
        my $ignoreIssued            = $session_data->{'ignoreIssued'}            || 0;
        my $ignoreWaitingHolds      = $session_data->{'ignoreWaitingHolds'}      || 0;
        my $skipCheckedOutItems     = $session_data->{'skipCheckedOutItems'}     || 0;
        my $skipInTransitItems      = $session_data->{'skipInTransitItems'}      || 0;
        my $skipBranchMismatchItems = $session_data->{'skipBranchMismatchItems'} || 0;
        my $compareBarcodes         = $session_data->{'compareBarcodes'}         || 0;

        if ($skipCheckedOutItems) {
            $ignoreIssued = 1;
        }

        # Ensure selectedItypes is an array
        my @selectedItypes;
        if ( defined $session_data->{'selectedItypes'} && ref( $session_data->{'selectedItypes'} ) eq 'ARRAY' ) {
            @selectedItypes = map { "'$_'" } @{ $session_data->{'selectedItypes'} };
        }

        my $selectedbranchcode = $session_data->{'selectedLibraryId'} || '';
        my $shelvingLocation   = $session_data->{'shelvingLocation'}  || '';
        my $branchField        = $session_data->{'branchField'}       || 'homebranch';

        # Build common parameters for both queries
        my $common_params = {
            minlocation => $minLocation,
            maxlocation => $maxLocation,
            branch      => $branchField,
            branchcode  => $selectedbranchcode,
            ccode       => $ccode,
        };

        # If shelving location is set, use it as the location parameter
        if ($shelvingLocation) {
            $common_params->{location} = $shelvingLocation;
        } elsif ($locationLoop) {
            $common_params->{location} = $locationLoop;
        }

        # Only generate right_place_list if compareBarcodes is enabled
        # Uses barcode-only query — returns arrayref of barcode strings
        my $rightPlaceList = [];
        if ($compareBarcodes) {
            $rightPlaceList = _get_right_place_barcodes(
                {
                    %$common_params,
                    skip_branch_mismatch => $skipBranchMismatchItems,
                }
            );
        }

        my $inventory_params = {
            %$common_params,
            class_source         => $classSource,
            ignoreissued         => $ignoreIssued,
            datelastseen         => $dateLastSeen,
            branchcode           => $selectedbranchcode,
            statushash           => $selectedStatuses,
            ignore_waiting_holds => $ignoreWaitingHolds,
            itemtypes            => \@selectedItypes,
            skip_in_transit      => $skipInTransitItems,
            skip_branch_mismatch => $skipBranchMismatchItems,
        };

        my ( $conditions, $joins ) = _build_inventory_conditions($inventory_params);
        my $search_cond = @$conditions ? { -and => $conditions } : {};
        my $count_attrs = {};
        $count_attrs->{join} = $joins if @$joins;
        my $iTotalRecords = Koha::Items->search( $search_cond, $count_attrs )->count;

        my $response = {
            total_records    => $iTotalRecords,
            right_place_list => $rightPlaceList,
            inventory_params => $inventory_params,
        };

        # Return the JSON response
        print encode_json($response);
    };

    # Handle any errors that occurred during processing
    if ($@) {
        warn "Error in start_session: $@";
        print encode_json(
            {
                error   => "Error processing request: $@",
                success => 0
            }
        );
    }
}

sub get_inventory_page {
    my ( $self, $args ) = @_;

    my $cgi = $self->{cgi};
    print $cgi->header('application/json');

    eval {
        my $params_json = uri_unescape( $cgi->param('inventory_params') || '{}' );
        my $params      = decode_json($params_json);
        my $offset      = int( $cgi->param('offset') || 0 );
        my $size        = int( $cgi->param('size')   || 80000 );

        my ( $items, undef ) =
            _get_items_for_inventory( { %$params, offset => $offset, size => $size, skip_count => 1 } );

        print encode_json(
            {
                items  => $items,
                offset => $offset,
                size   => $size,
            }
        );
    };

    if ($@) {
        warn "Error in get_inventory_page: $@";
        print encode_json( { error => "Error: $@", success => 0 } );
    }
}

sub _get_items_for_inventory {
    my ($params) = @_;

    my ( $conditions, $joins ) = _build_inventory_conditions($params);
    my $search_cond = @$conditions ? { -and => $conditions } : {};

    my $total_count = 0;
    unless ( $params->{skip_count} ) {
        my $count_attrs = {};
        $count_attrs->{join} = $joins if @$joins;
        $total_count = Koha::Items->search( $search_cond, $count_attrs )->count;
    }

    my $data_attrs = {
        join    => [ 'biblio', @$joins ],
        columns => [
            'me.itemnumber',
            'me.barcode',
            'me.itemcallnumber',
            'me.biblionumber',
            'me.datelastseen',
            'me.homebranch',
            'me.holdingbranch',
            'me.location',
            'me.notforloan',
            'me.damaged',
            'me.itemlost',
            'me.withdrawn',
            'me.stocknumber',
            'me.cn_sort',
            'me.ccode',
            'me.enumchron',
        ],
        '+columns' => {
            title         => 'biblio.title',
            author        => 'biblio.author',
            frameworkcode => 'biblio.frameworkcode',
        },
        order_by => { -asc => [ 'me.cn_sort', 'me.itemcallnumber', 'biblio.title' ] },
    };

    if ( defined $params->{offset} && $params->{size} ) {
        $data_attrs->{offset} = $params->{offset};
        $data_attrs->{rows}   = $params->{size};
    }

    my ( $sql, @bind ) = _dbic_to_dbi( Koha::Items->search( $search_cond, $data_attrs ) );

    my @items = @{ C4::Context->dbh->selectall_arrayref( $sql, { Slice => {} }, @bind ) };

    my @itemnumbers = map { $_->{itemnumber} } @items;
    _enrich_transit_and_checkout( \@items, \@itemnumbers ) if @itemnumbers;

    return ( \@items, $total_count );
}

sub _get_right_place_barcodes {
    my ($params) = @_;

    my ( $conditions, $joins ) = _build_inventory_conditions($params);
    my $search_cond = @$conditions ? { -and => $conditions } : {};

    my ( $sql, @bind ) = _dbic_to_dbi(
        Koha::Items->search(
            $search_cond,
            {
                ( @$joins ? ( join => $joins ) : () ),
                columns => ['me.barcode'],
            }
        )
    );

    my $barcodes = C4::Context->dbh->selectcol_arrayref( $sql, {}, @bind );
    return [ grep { defined } @$barcodes ];
}

sub _dbic_to_dbi {
    my ($rs) = @_;

    my $query_ref = ${ $rs->_resultset->as_query };
    my $sql       = $query_ref->[0];
    my @bind      = map { $_->[1] } @{$query_ref}[ 1 .. $#$query_ref ];

    return ( $sql, @bind );
}

sub _build_inventory_conditions {
    my ($params) = @_;

    my @conditions;
    my @joins;

    my $class_source = $params->{class_source} // C4::Context->preference('DefaultClassificationSource');
    my $minlocation  = $params->{minlocation};
    my $maxlocation  = $params->{maxlocation};
    my $datelastseen = $params->{datelastseen};
    my $location     = $params->{location};
    my $ccode        = $params->{ccode};
    my $branchcode   = $params->{branchcode};
    my $branch       = $params->{branch};
    my $statushash   = $params->{statushash};
    my $itemtypes    = $params->{itemtypes} || [];

    if ($minlocation) {
        my $min_cnsort = GetClassSort( $class_source, undef, $minlocation );
        push @conditions, { 'me.cn_sort' => { '>=' => $min_cnsort } }
            if $min_cnsort;
    }

    if ($maxlocation) {
        my $max_cnsort = GetClassSort( $class_source, undef, $maxlocation );
        push @conditions, { 'me.cn_sort' => { '<=' => $max_cnsort } }
            if $max_cnsort;
    }

    if ($datelastseen) {
        push @conditions, {
            -or => [
                { 'me.datelastseen' => { '<' => $datelastseen } },
                { 'me.datelastseen' => undef },
            ]
        };
    }

    push @conditions, { 'me.location' => $location } if $location;
    push @conditions, { 'me.ccode'    => $ccode }    if $ccode;

    if ($branchcode) {
        my $field =
            ( $branch && $branch eq 'homebranch' )
            ? 'me.homebranch'
            : 'me.holdingbranch';
        push @conditions, { $field => $branchcode };
    }

    if ( $statushash && ref $statushash eq 'HASH' ) {
        for my $field ( keys %$statushash ) {
            next
                unless ref $statushash->{$field} eq 'ARRAY'
                && @{ $statushash->{$field} };
            ( my $dbic_field = $field ) =~ s/^items\./me./;
            push @conditions, { $dbic_field => { -in => $statushash->{$field} } };
        }
    }

    if (@$itemtypes) {
        push @joins, 'biblioitem';
        push @conditions, [
            { 'biblioitem.itemtype' => { -in => $itemtypes } },
            { 'me.itype'            => { -in => $itemtypes } },
        ];
    }

    if ( $params->{ignoreissued} ) {
        my $issued_itemnumbers =
            Koha::Checkouts->search( {}, { columns => ['itemnumber'] } )->_resultset->get_column('itemnumber')
            ->as_query;
        push @conditions, { 'me.itemnumber' => { -not_in => $issued_itemnumbers } };
    }

    if ( $params->{ignore_waiting_holds} ) {
        my $waiting_itemnumbers = Koha::Holds->search(
            { found   => 'W', itemnumber => { '!=' => undef } },
            { columns => ['itemnumber'] }
        )->_resultset->get_column('itemnumber')->as_query;
        push @conditions, { 'me.itemnumber' => { -not_in => $waiting_itemnumbers } };
    }

    if ( $params->{skip_branch_mismatch} ) {
        push @conditions, -or => [
            \['me.holdingbranch = me.homebranch'],
            { 'me.holdingbranch' => undef },
        ];
    }

    if ( $params->{skip_in_transit} ) {
        push @conditions,
            \[
            'NOT EXISTS (SELECT 1 FROM branchtransfers WHERE branchtransfers.itemnumber = me.itemnumber AND datearrived IS NULL AND datecancelled IS NULL AND datesent IS NOT NULL)'
            ];
    }

    return ( \@conditions, \@joins );
}

sub _enrich_transit_and_checkout {
    my ( $items, $itemnumbers ) = @_;

    my %transit_map;
    my $transfers_rs = Koha::Item::Transfers->search(
        {
            itemnumber    => { -in => $itemnumbers },
            datearrived   => undef,
            datecancelled => undef,
            datesent      => { '!=' => undef },
        }
    );
    while ( my $t = $transfers_rs->next ) {
        $transit_map{ $t->itemnumber } = 1;
    }

    my %checkout_map;
    my $checkouts_rs = Koha::Checkouts->search( { itemnumber => { -in => $itemnumbers } } );
    while ( my $co = $checkouts_rs->next ) {
        $checkout_map{ $co->itemnumber } = 1;
    }

    for my $item_hash (@$items) {
        $item_hash->{in_transit}  = $transit_map{ $item_hash->{itemnumber} }  ? 1 : 0;
        $item_hash->{checked_out} = $checkout_map{ $item_hash->{itemnumber} } ? 1 : 0;
    }
}

=head3

=cut

sub install {
    my ( $self, $args ) = @_;
    _ensure_authorized_values();
    return 1;
}

sub upgrade {
    my ( $self, $args ) = @_;
    _ensure_authorized_values();
    return 1;
}

sub _ensure_authorized_values {

    # Ensure the FOUND:INVENTORY authorized value exists in RETURN_CLAIM_RESOLUTION.
    # Without this value, resolving return claims with "FOUND:INVENTORY" will cause
    # the Return Claims tab on patron accounts to fail to load.
    my $exists = Koha::AuthorisedValues->search(
        {
            category         => 'RETURN_CLAIM_RESOLUTION',
            authorised_value => 'FOUND:INVENTORY',
        }
    )->count;

    unless ($exists) {
        Koha::AuthorisedValue->new(
            {
                category         => 'RETURN_CLAIM_RESOLUTION',
                authorised_value => 'FOUND:INVENTORY',
                lib              => 'Found during inventory',
            }
        )->store;
    }
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
