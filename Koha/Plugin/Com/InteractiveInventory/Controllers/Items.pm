package Koha::Plugin::Com::InteractiveInventory::Controllers::Items;

use Modern::Perl;
use Mojo::Base 'Mojolicious::Controller';
use Mojo::JSON qw(decode_json);
use Try::Tiny;
use C4::Context;
use C4::Circulation qw( AddReturn CanBookBeRenewed AddRenewal );
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
    my $branch_code = $transit_data->{branchCode} || C4::Context->userenv->{branch};
    
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
    
    # Check if the item is in transit
    my $item_data = $item->unblessed;
    
    unless ($item_data->{in_transit}) {
        return $c->render(
            status => 404,
            openapi => { error => "Item is not in transit" }
        );
    }
    
    try {
        # Reset the in_transit flag
        $item->in_transit(0);
        
        # Update the holding branch to the current branch
        $item->holdingbranch($branch_code);
        
        # Store the changes
        $item->store;
        
        return $c->render(
            status => 200,
            openapi => {
                status => "success",
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

1;