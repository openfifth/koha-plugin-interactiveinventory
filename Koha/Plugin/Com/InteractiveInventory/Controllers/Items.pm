package Koha::Plugin::Com::InteractiveInventory::Controllers::Items;

use Modern::Perl;
use Mojo::Base 'Mojolicious::Controller';
use Mojo::JSON qw(decode_json);
use Try::Tiny;
use C4::Context;
use C4::Circulation qw( AddReturn );
use Koha::DateUtils qw( dt_from_string );
use Koha::Items;
use Koha::Libraries;
use Koha::Holds;

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
        # Get the Koha item
        my $item_object = $item->unblessed;
        
        # Check if the item is checked out
        if ($item_object->{onloan}) {
            # Here you would implement the check-in logic
            # For demo purposes, we're just updating the onloan status directly
            $item->onloan(undef);
            $item->store;
            
            return $c->render(
                status => 200,
                openapi => {
                    success => "Item checked in successfully"
                }
            );
        } else {
            return $c->render(
                status => 200,
                openapi => {
                    success => "Item was not checked out"
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

1;