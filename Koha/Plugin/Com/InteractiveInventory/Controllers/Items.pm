package Koha::Plugin::Com::InteractiveInventory::Controllers::Items;

use Modern::Perl;
use Mojo::Base 'Mojolicious::Controller';
use Mojo::JSON qw(decode_json);
use Try::Tiny;
use C4::Context;
use C4::Circulation qw( AddReturn CanBookBeRenewed AddRenewal );
use C4::ShelfBrowser qw( GetNearbyItems );
use Koha::DateUtils qw( dt_from_string );
use Koha::Items;
use Koha::Libraries;
use Koha::Holds;
use Koha::Checkouts;

=head1 API

=head2 Methods

=head3 modifyItemFields

Updates item fields based on the provided data

=cut

sub modifyItemFields {
    my $c = shift->openapi->valid_input or return;

    my $item_data = $c->validation->param('body');
    
    unless ( $item_data && $item_data->{items} ) {
        return $c->render(
            status => 400,
            openapi => { error => "Missing items data" }
        );
    }

    my @results;
    
    foreach my $item_info ( @{ $item_data->{items} } ) {
        my $barcode = $item_info->{barcode};
        my $fields = $item_info->{fields};
        
        unless ( $barcode && $fields ) {
            push @results, {
                barcode => $barcode || 'Unknown',
                status => 400,
                error => "Missing barcode or fields to update"
            };
            next;
        }
        
        my $item = Koha::Items->find({ barcode => $barcode });
        
        unless ( $item ) {
            push @results, {
                barcode => $barcode,
                status => 404,
                error => "Item not found"
            };
            next;
        }
        
        try {
            foreach my $field_name ( keys %$fields ) {
                my $value = $fields->{$field_name};
                $item->$field_name($value);
            }
            $item->store;
            
            push @results, {
                barcode => $barcode,
                status => 200,
                success => "Item updated successfully"
            };
        } catch {
            push @results, {
                barcode => $barcode,
                status => 500,
                error => "Error updating item: $_"
            };
        };
    }
    
    return $c->render( status => 200, openapi => { results => \@results } );
}

=head3 modifyItemField

Updates a single item's fields based on the provided data

=cut

sub modifyItemField {
    my $c = shift->openapi->valid_input or return;

    my $item_data = $c->validation->param('body');
    
    my $barcode = $item_data->{barcode};
    my $fields = $item_data->{fields};
    
    unless ( $barcode && $fields ) {
        return $c->render(
            status => 400,
            openapi => { error => "Missing barcode or fields to update" }
        );
    }
    
    my $item = Koha::Items->find({ barcode => $barcode });
    
    unless ( $item ) {
        return $c->render(
            status => 404,
            openapi => { error => "Item not found" }
        );
    }
    
    try {
        foreach my $field_name ( keys %$fields ) {
            my $value = $fields->{$field_name};
            $item->$field_name($value);
        }
        $item->store;
        
        return $c->render(
            status => 200,
            openapi => {
                barcode => $barcode,
                status => 200,
                success => "Item updated successfully"
            }
        );
    } catch {
        return $c->render(
            status => 500,
            openapi => {
                barcode => $barcode,
                status => 500,
                error => "Error updating item: $_"
            }
        );
    };
}

=head3 checkInItem

Checks in an item using the barcode and date provided

=cut

sub checkInItem {
    my $c = shift->openapi->valid_input or return;

    my $item_data = $c->validation->param('body');
    
    my $barcode = $item_data->{barcode};
    my $date = $item_data->{date} || undef;
    
    unless ( $barcode ) {
        return $c->render(
            status => 400,
            openapi => { error => "Missing barcode" }
        );
    }
    
    my $item = Koha::Items->find({ barcode => $barcode });
    
    unless ( $item ) {
        return $c->render(
            status => 404,
            openapi => { error => "Item not found" }
        );
    }
    
    try {
        # Get the current branch from user environment, fallback to item's homebranch
        my $branch = C4::Context->userenv->{branch} || $item->homebranch;
        my $return_date = $date ? dt_from_string($date) : dt_from_string();

        # Use Koha's proper circulation system for check-in
        # AddReturn handles all circulation logic including:
        # - Updating circulation records
        # - Recording statistics
        # - Handling fines and fees
        # - Processing holds
        # - Updating item status
        my ($doreturn, $messages, $iteminformation, $borrower) = AddReturn(
            $barcode,
            $branch,
            undef,  # exemptfine - don't exempt fines by default
            $return_date
        );

        if ($doreturn) {
            my $response = {
                success => "Item checked in successfully",
                return_date => $return_date->ymd,
                branch => $branch
            };

            # Include any important messages from the checkin process
            if ($messages && keys %$messages) {
                $response->{messages} = $messages;

                # Add specific message handling for common scenarios
                if ($messages->{ResFound}) {
                    $response->{hold_found} = 1;
                    $response->{hold_message} = "Item has holds - please process accordingly";
                }
                if ($messages->{WasReturned}) {
                    $response->{was_returned} = 1;
                }
                if ($messages->{Wrongbranch}) {
                    $response->{wrong_branch} = 1;
                    $response->{correct_branch} = $messages->{Wrongbranch}->{Rightbranch};
                }
                if ($messages->{NeedsTransfer}) {
                    $response->{needs_transfer} = 1;
                    $response->{transfer_to} = $messages->{NeedsTransfer};
                    $response->{transfer_message} = "Item needs to be transferred to another library";
                }
                if ($messages->{TransferTo}) {
                    $response->{needs_transfer} = 1;
                    $response->{transfer_to} = $messages->{TransferTo};
                    $response->{transfer_message} = "Item needs to be transferred to another library";
                }
            }

            return $c->render(
                status => 200,
                openapi => $response
            );
        } else {
            # Check for specific error conditions
            my $error_msg = "Failed to check in item";
            my $status_code = 500;

            if ($messages && $messages->{BadBarcode}) {
                $error_msg = "Invalid barcode: $barcode";
                $status_code = 400;
            } elsif ($messages && $messages->{NotIssued}) {
                $error_msg = "Item was not checked out";
                $status_code = 200;  # This is actually a success case
                return $c->render(
                    status => 200,
                    openapi => {
                        success => "Item was not checked out",
                        messages => $messages
                    }
                );
            }

            return $c->render(
                status => $status_code,
                openapi => {
                    error => $error_msg,
                    messages => $messages
                }
            );
        }
    } catch {
        return $c->render(
            status => 500,
            openapi => {
                error => "Error checking in item: $_"
            }
        );
    };
}

=head3 resolveTransit

Resolves in-transit status for an item

=cut

sub resolveTransit {
    my $c = shift->openapi->valid_input or return;

    my $transit_data = $c->validation->param('body');
    
    my $barcode = $transit_data->{barcode};
    
    unless ($barcode) {
        return $c->render(
            status => 400,
            openapi => { error => "Missing barcode" }
        );
    }
    
    my $item = Koha::Items->find({ barcode => $barcode });
    
    unless ($item) {
        return $c->render(
            status => 404,
            openapi => { error => "Item not found" }
        );
    }
    
    # Get the active transfer using Koha's transfer API
    my $transfer = $item->get_transfer;
    
    unless ($transfer && $transfer->in_transit) {
        return $c->render(
            status => 404,
            openapi => { error => "Item is not in transit" }
        );
    }
    
    try {
        # Use Koha's proper transfer API to receive the item
        # This sets datearrived, updates date_last_seen, and maintains audit trail
        $transfer->receive;
        
        return $c->render(
            status => 200,
            openapi => {
                status  => "success",
                message => "Transit resolved successfully"
            }
        );
    } catch {
        return $c->render(
            status => 500,
            openapi => {
                error => "Error resolving transit: $_"
            }
        );
    };
}

=head3 renewItem

Renews a checkout using the barcode provided

=cut

sub renewItem {
    my $c = shift->openapi->valid_input or return;

    my $renewal_data = $c->validation->param('body');

    my $barcode = $renewal_data->{barcode};
    my $seen = defined($renewal_data->{seen}) ? $renewal_data->{seen} : 1;

    unless ($barcode) {
        return $c->render(
            status => 400,
            openapi => { error => "Missing barcode" }
        );
    }

    my $item = Koha::Items->find({ barcode => $barcode });

    unless ($item) {
        return $c->render(
            status => 404,
            openapi => { error => "Item not found" }
        );
    }

    # Find the current checkout for this item
    my $checkout = Koha::Checkouts->search({ itemnumber => $item->itemnumber })->next;

    unless ($checkout) {
        return $c->render(
            status => 404,
            openapi => { error => "Item is not currently checked out" }
        );
    }

    eval {
        my $patron = $checkout->patron;
        # Check if the item can be renewed
        my ($can_renew, $error) = CanBookBeRenewed($patron, $checkout);

        unless ($can_renew) {
            return $c->render(
                status => 403,
                openapi => {
                    error => "Cannot renew checkout",
                    details => $error || "Renewal not allowed"
                }
            );
        }

        # Get the current branch from user environment
        my $branch = C4::Context->userenv->{branch} || $item->homebranch;



        unless ($item && $checkout->borrowernumber) {
            return $c->render(
                status => 500,
                openapi => { error => "Missing itemnumber or borrowernumber" }
            );
        }

        my $renewal_result = AddRenewal({
            borrowernumber => $checkout->borrowernumber,
            itemnumber     => $item->itemnumber,
            branch         => $branch,
            seen           => $seen
        });

        if ($renewal_result) {
            # Fetch the updated checkout to get new due date and renewal count
            my $updated_checkout = Koha::Checkouts->find($checkout->issue_id);

            return $c->render(
                status => 200,
                openapi => {
                    success => "Item renewed successfully",
                    checkout_id => $checkout->issue_id,
                    new_due_date => $updated_checkout->date_due,
                    renewals_count => $updated_checkout->renewals_count
                }
            );
        } else {
            return $c->render(
                status => 500,
                openapi => {
                    error => "Failed to renew item"
                }
            );
        }
    };
    if ($@) {
        return $c->render(
            status => 500,
            openapi => {
                error => "Error renewing item: $@"
            }
        );
    }
}

=head3 shelfBrowser

Gets nearby items on the shelf, filtered by inventory session parameters

=cut

sub shelfBrowser {
    my $c = shift->openapi->valid_input or return;

    my $itemnumber = $c->validation->param('itemnumber');
    my $num_each_side = $c->validation->param('num_each_side') // 5;
    my $homebranch = $c->validation->param('homebranch');
    my $location = $c->validation->param('location');
    my $ccode = $c->validation->param('ccode');

    unless ($itemnumber) {
        return $c->render(
            status => 400,
            openapi => { error => "Missing itemnumber parameter" }
        );
    }

    # Verify item exists
    my $item = Koha::Items->find($itemnumber);
    unless ($item) {
        return $c->render(
            status => 404,
            openapi => { error => "Item not found" }
        );
    }

    try {
        my $dbh = C4::Context->dbh;
        my $gap = ($num_each_side * 2) + 1;

        # Get starting item details
        my $start_cn_sort = $item->cn_sort;
        my $start_homebranch = $homebranch || $item->homebranch;
        my $start_location = $location || $item->location;
        my $start_ccode = $ccode || $item->ccode;

        # Build query conditions based on provided filters
        my @params = ($start_cn_sort, $itemnumber, $start_cn_sort);
        my $query_cond = '';

        if ($start_homebranch) {
            $query_cond .= 'AND homebranch = ? ';
            push @params, $start_homebranch;
        }
        if ($start_location) {
            $query_cond .= 'AND location = ? ';
            push @params, $start_location;
        }
        if ($start_ccode) {
            $query_cond .= 'AND ccode = ? ';
            push @params, $start_ccode;
        }

        # Query for previous items (before current cn_sort)
        my $prev_query = qq{
            SELECT i.itemnumber, i.biblionumber, i.cn_sort, i.itemcallnumber,
                   b.title, b.subtitle, b.medium, b.part_number, b.part_name
            FROM items i
            LEFT JOIN biblio b ON i.biblionumber = b.biblionumber
            WHERE ((i.cn_sort = ? AND i.itemnumber < ?) OR i.cn_sort < ?)
            $query_cond
            ORDER BY i.cn_sort DESC, i.itemnumber DESC
            LIMIT ?
        };

        # Query for next items (after current cn_sort)
        my $next_query = qq{
            SELECT i.itemnumber, i.biblionumber, i.cn_sort, i.itemcallnumber,
                   b.title, b.subtitle, b.medium, b.part_number, b.part_name
            FROM items i
            LEFT JOIN biblio b ON i.biblionumber = b.biblionumber
            WHERE ((i.cn_sort = ? AND i.itemnumber >= ?) OR i.cn_sort > ?)
            $query_cond
            ORDER BY i.cn_sort, i.itemnumber
            LIMIT ?
        };

        my @prev_items = @{
            $dbh->selectall_arrayref($prev_query, { Slice => {} }, (@params, $gap))
        };
        my @next_items = @{
            $dbh->selectall_arrayref($next_query, { Slice => {} }, (@params, $gap + 1))
        };

        # Store the furthest items for prev/next navigation
        my $prev_item = $prev_items[-1];
        my $next_item = $next_items[-1];

        # Trim to requested number
        @next_items = splice(@next_items, 0, $num_each_side + 1);
        @prev_items = reverse splice(@prev_items, 0, $num_each_side);

        # Combine: previous items + current item onwards
        my @items = (@prev_items, @next_items);

        # Format the response
        my @formatted_items = map {
            {
                itemnumber     => $_->{itemnumber},
                biblionumber   => $_->{biblionumber},
                itemcallnumber => $_->{itemcallnumber},
                cn_sort        => $_->{cn_sort},
                title          => $_->{title},
                subtitle       => $_->{subtitle},
                medium         => $_->{medium},
                part_number    => $_->{part_number},
                part_name      => $_->{part_name},
            }
        } @items;

        # Get descriptions for the starting filters
        my $starting_homebranch_desc;
        if ($start_homebranch) {
            my $lib = Koha::Libraries->find($start_homebranch);
            $starting_homebranch_desc = {
                code => $start_homebranch,
                description => $lib ? $lib->branchname : $start_homebranch
            };
        }

        return $c->render(
            status => 200,
            openapi => {
                items => \@formatted_items,
                prev_item => $prev_item ? {
                    itemnumber   => $prev_item->{itemnumber},
                    biblionumber => $prev_item->{biblionumber},
                } : undef,
                next_item => $next_item ? {
                    itemnumber   => $next_item->{itemnumber},
                    biblionumber => $next_item->{biblionumber},
                } : undef,
                starting_homebranch => $starting_homebranch_desc,
                starting_location   => $start_location ? { code => $start_location } : undef,
                starting_ccode      => $start_ccode ? { code => $start_ccode } : undef,
            }
        );
    } catch {
        return $c->render(
            status => 500,
            openapi => {
                error => "Error fetching nearby items: $_"
            }
        );
    };
}

1;