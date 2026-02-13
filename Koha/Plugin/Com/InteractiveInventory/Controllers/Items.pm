package Koha::Plugin::Com::InteractiveInventory::Controllers::Items;

use Modern::Perl;
use Mojo::Base 'Mojolicious::Controller';
use Mojo::JSON qw(decode_json);
use Try::Tiny;
use C4::Context;
use C4::Circulation qw( AddReturn CanBookBeRenewed AddRenewal );
use C4::Reserves qw( ModReserveAffect );
use C4::ShelfBrowser qw( GetNearbyItems );
use Koha::DateUtils qw( dt_from_string );
use Koha::Items;
use Koha::Libraries;
use Koha::Holds;
use Koha::Checkouts;
use Koha::Item::Transfers;
use Koha::Patrons;

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
                    my $hold_info = $messages->{ResFound};
                    
                    # Actually trap the hold by setting it to Waiting or In Transit status
                    # ModReserveAffect($itemnumber, $borrowernumber, $transferToBranch, $reserve_id)
                    my $hold_needs_transfer = 0;
                    if ($hold_info->{reserve_id} && $hold_info->{borrowernumber}) {
                        my $transfer_branch = undef;
                        # If hold pickup is different from current branch, a transfer is needed
                        if ($hold_info->{branchcode} && $hold_info->{branchcode} ne $branch) {
                            $transfer_branch = $hold_info->{branchcode};
                            $hold_needs_transfer = 1;
                        }
                        ModReserveAffect($item->itemnumber, $hold_info->{borrowernumber}, $transfer_branch, $hold_info->{reserve_id});
                    }
                    
                    # Look up patron name from borrowernumber (ResFound only has reserves fields)
                    if ($hold_info->{borrowernumber}) {
                        my $patron = Koha::Patrons->find($hold_info->{borrowernumber});
                        if ($patron) {
                            my $patron_name = join(' ', grep { $_ } ($patron->firstname, $patron->surname));
                            $response->{hold_patron_name} = $patron_name if $patron_name;
                        }
                    }
                    if ($hold_info->{branchcode}) {
                        $response->{hold_pickup_branch} = $hold_info->{branchcode};
                    }
                    
                    # Flag if hold requires transfer to pickup branch
                    if ($hold_needs_transfer) {
                        $response->{hold_needs_transfer} = 1;
                        $response->{needs_transfer} = 1;
                        $response->{transfer_to} = $hold_info->{branchcode};
                        $response->{hold_message} = "Item has been trapped for a hold. Transfer to pickup branch.";
                    } else {
                        $response->{hold_message} = "Item has been trapped for a hold. Do not reshelve.";
                    }
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

Gets nearby items on the shelf, filtered by inventory session parameters.
Optimized for speed with simple range queries.

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

    my $item = Koha::Items->find($itemnumber);
    unless ($item) {
        return $c->render(
            status => 404,
            openapi => { error => "Item not found" }
        );
    }

    try {
        my $dbh = C4::Context->dbh;
        my $start_cn_sort = $item->cn_sort // '';
        
        # Use provided filters or fall back to item's values
        my $filter_homebranch = $homebranch // $item->homebranch;
        my $filter_location = $location // $item->location;
        my $filter_ccode = $ccode // $item->ccode;

        # Build WHERE conditions - simple AND conditions use indexes well
        # Exclude items without call numbers (NULL or empty)
        my @conditions = ("cn_sort IS NOT NULL", "cn_sort != ''", "itemcallnumber IS NOT NULL", "itemcallnumber != ''");
        my @params;

        if ($filter_homebranch) {
            push @conditions, 'homebranch = ?';
            push @params, $filter_homebranch;
        }
        if ($filter_location) {
            push @conditions, 'location = ?';
            push @params, $filter_location;
        }
        if ($filter_ccode) {
            push @conditions, 'ccode = ?';
            push @params, $filter_ccode;
        }

        my $where_base = join(' AND ', @conditions);

        # Step 1: Fast queries to get just itemnumbers (no JOIN)
        my $prev_sql = "SELECT itemnumber FROM items WHERE $where_base AND cn_sort < ? ORDER BY cn_sort DESC LIMIT ?";
        my $next_sql = "SELECT itemnumber FROM items WHERE $where_base AND cn_sort >= ? ORDER BY cn_sort ASC LIMIT ?";

        my $prev_ids = $dbh->selectcol_arrayref($prev_sql, {}, @params, $start_cn_sort, $num_each_side);
        my $next_ids = $dbh->selectcol_arrayref($next_sql, {}, @params, $start_cn_sort, $num_each_side + 1);

        # Combine and fetch full data only for the items we need
        my @all_ids = (@{$prev_ids || []}, @{$next_ids || []});
        
        my @items;
        if (@all_ids) {
            my $placeholders = join(',', ('?') x @all_ids);
            my $detail_sql = qq{
                SELECT i.itemnumber, i.biblionumber, i.cn_sort, i.itemcallnumber, i.location,
                       b.title, b.subtitle, b.medium, b.part_number, b.part_name
                FROM items i
                LEFT JOIN biblio b ON i.biblionumber = b.biblionumber
                WHERE i.itemnumber IN ($placeholders)
                ORDER BY i.cn_sort ASC
            };
            my $rows = $dbh->selectall_arrayref($detail_sql, { Slice => {} }, @all_ids);
            @items = @{$rows || []};
        }

        return $c->render(
            status => 200,
            openapi => {
                items => \@items,
                starting_homebranch => $filter_homebranch ? { code => $filter_homebranch } : undef,
                starting_location => $filter_location ? { code => $filter_location } : undef,
                starting_ccode => $filter_ccode ? { code => $filter_ccode } : undef,
            }
        );
    } catch {
        return $c->render(
            status => 500,
            openapi => { error => "Error fetching nearby items: $_" }
        );
    };
}

=head3 scanItem

Gets comprehensive item data for inventory scanning, including biblio,
checkout, transfer, hold, and return claim information.

=cut

sub scanItem {
    my $c = shift->openapi->valid_input or return;

    my $barcode = $c->validation->param('barcode');

    unless ($barcode) {
        return $c->render(
            status => 400,
            openapi => { error => "Missing barcode parameter" }
        );
    }

    my $item = Koha::Items->find({ barcode => $barcode });
    unless ($item) {
        return $c->render(
            status => 404,
            openapi => { error => "Item not found" }
        );
    }

    try {
        # Build comprehensive item data
        my $item_data = {
            item_id             => $item->itemnumber,
            biblio_id           => $item->biblionumber,
            external_id         => $item->barcode,
            home_library_id     => $item->homebranch,
            holding_library_id  => $item->holdingbranch,
            location            => $item->location,
            permanent_location  => $item->permanent_location,
            callnumber          => $item->itemcallnumber,
            call_number_sort    => $item->cn_sort,
            collection_code     => $item->ccode,
            item_type_id        => $item->itype,
            lost_status         => $item->itemlost,
            lost_date           => $item->itemlost_on,
            damaged_status      => $item->damaged,
            damaged_date        => $item->damaged_on,
            withdrawn           => $item->withdrawn,
            withdrawn_date      => $item->withdrawn_on,
            not_for_loan_status => $item->notforloan,
            restricted_status   => $item->restricted,
            last_seen_date      => $item->datelastseen,
            last_checkout_date  => $item->datelastborrowed,
            checkouts_count     => $item->issues,
            renewals_count      => $item->renewals,
            holds_count         => $item->reserves,
            public_notes        => $item->itemnotes,
            internal_notes      => $item->itemnotes_nonpublic,
            copy_number         => $item->copynumber,
            inventory_number    => $item->stocknumber,
            replacement_price   => $item->replacementprice,
        };

        # Get biblio data
        my $biblio = $item->biblio;
        if ($biblio) {
            $item_data->{biblio} = {
                biblio_id   => $biblio->biblionumber,
                title       => $biblio->title,
                subtitle    => $biblio->subtitle,
                author      => $biblio->author,
                copyrightdate => $biblio->copyrightdate,
                serial      => $biblio->serial,
            };
        }

        # Get checkout data
        my $checkout = Koha::Checkouts->find({ itemnumber => $item->itemnumber });
        if ($checkout) {
            $item_data->{checked_out_date} = $checkout->issuedate;
            $item_data->{checkout} = {
                checkout_id     => $checkout->issue_id,
                patron_id       => $checkout->borrowernumber,
                due_date        => $checkout->date_due,
                issue_date      => $checkout->issuedate,
                renewals_count  => $checkout->renewals_count,
                auto_renew      => $checkout->auto_renew,
            };
            # Get patron name if possible
            my $patron = $checkout->patron;
            if ($patron) {
                $item_data->{checkout}{patron} = {
                    patron_id  => $patron->borrowernumber,
                    firstname  => $patron->firstname,
                    surname    => $patron->surname,
                    cardnumber => $patron->cardnumber,
                };
            }
        }

        # Get active transfer data
        my $transfer = $item->get_transfer;
        if ($transfer && $transfer->in_transit) {
            $item_data->{transfer} = {
                transfer_id   => $transfer->branchtransfer_id,
                from_library  => $transfer->frombranch,
                to_library    => $transfer->tobranch,
                sent_date     => $transfer->datesent,
                reason        => $transfer->reason,
            };
            $item_data->{in_transit} = 1;
        }

        # Get first hold (waiting or pending)
        my $holds = Koha::Holds->search(
            { itemnumber => $item->itemnumber },
            { order_by => { -asc => 'priority' }, rows => 1 }
        );
        my $first_hold = $holds->next;
        if ($first_hold) {
            $item_data->{first_hold} = {
                hold_id         => $first_hold->reserve_id,
                patron_id       => $first_hold->borrowernumber,
                status          => $first_hold->found,
                priority        => $first_hold->priority,
                pickup_library  => $first_hold->branchcode,
                hold_date       => $first_hold->reservedate,
                expiration_date => $first_hold->expirationdate,
                waiting_date    => $first_hold->waitingdate,
            };
            # Check if it's a waiting hold
            $item_data->{waiting} = ($first_hold->found && $first_hold->found eq 'W') ? 1 : 0;
        }

        # Get return claims
        my @return_claims;
        my $claims_rs = $item->return_claims;
        while (my $claim = $claims_rs->next) {
            push @return_claims, {
                claim_id    => $claim->id,
                patron_id   => $claim->borrowernumber,
                created_on  => $claim->created_on,
                resolved_on => $claim->resolved_on,
                resolution  => $claim->resolution,
            };
        }
        if (@return_claims) {
            $item_data->{return_claims} = \@return_claims;
            # Set return_claim to first unresolved claim if any
            my @unresolved = grep { !$_->{resolved_on} } @return_claims;
            $item_data->{return_claim} = $unresolved[0] if @unresolved;
        }

        return $c->render(
            status => 200,
            openapi => $item_data
        );
    } catch {
        return $c->render(
            status => 500,
            openapi => { error => "Error fetching item data: $_" }
        );
    };
}

1;