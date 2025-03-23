package Koha::Plugin::Com::InteractiveInventory::Controllers::Items;

use Modern::Perl;
use Mojo::Base 'Mojolicious::Controller';
use Mojo::JSON qw(decode_json);
use Try::Tiny;
use C4::Context;
use C4::Circulation qw( AddReturn );
use Koha::DateUtils qw( dt_from_string );
use Koha::Items;

=head1 API

=head2 Methods

=head3 modifyItemFields

Updates item fields based on the provided data

=cut

sub modifyItemFields {
    my $c = shift->openapi->valid_input or return;

    # Get data from request
    my $data = $c->req->json;
    
    # If we receive a single item, wrap it in an array for consistent processing
    my $items = ref $data eq 'ARRAY' ? $data : 
                (defined $data->{items} ? $data->{items} : [$data]);

    my @results;

    return try {
        foreach my $item_data (@$items) {
            unless ( $item_data->{barcode} && $item_data->{fields} && %{ $item_data->{fields} } ) {
                push @results, { 
                    barcode => $item_data->{barcode}, 
                    status => 400, 
                    error => 'Missing barcode or fields to update' 
                };
                next;
            }

            # Find the item by barcode
            my $item = Koha::Items->find( { barcode => $item_data->{barcode} } );
            unless ($item) {
                push @results, { 
                    barcode => $item_data->{barcode}, 
                    status => 404, 
                    error => 'Item not found' 
                };
                next;
            }

            # Attempt to update the item fields
            try {
                # Create a hash of field changes to pass to set()
                my $field_changes = {};
                
                # Process each field
                foreach my $field (keys %{ $item_data->{fields} }) {
                    $field_changes->{$field} = $item_data->{fields}->{$field};
                }
                
                # Use set() to update all fields at once
                $item->set($field_changes);
                $item->store();

                push @results, { 
                    barcode => $item_data->{barcode}, 
                    status => 200, 
                    success => 'Item updated successfully' 
                };
            } catch {
                my $error = $_;
                push @results, { 
                    barcode => $item_data->{barcode}, 
                    status => 500, 
                    error => "Failed to update item: $error" 
                };
            };
        }

        return $c->render(
            status => 200,
            json   => { results => \@results }
        );
    }
    catch {
        $c->unhandled_exception($_);
    };
}

=head3 modifyItemField

Updates a single item's fields based on the provided data

=cut

sub modifyItemField {
    my $c = shift->openapi->valid_input or return;

    # Get data from request
    my $data = $c->req->json;

    # Validate required fields
    unless ( $data->{barcode} && $data->{fields} && %{ $data->{fields} } ) {
        return $c->render(
            status => 400,
            json   => { error => 'Missing barcode or fields to update' }
        );
    }

    return try {
        # Find the item by barcode
        my $item = Koha::Items->find( { barcode => $data->{barcode} } );
        unless ($item) {
            return $c->render(
                status => 404,
                json   => { error => 'Item not found' }
            );
        }

        # Use the set() method to update multiple fields at once
        $item->set($data->{fields});
        
        # Store the changes
        $item->store();

        return $c->render(
            status => 200,
            json   => { 
                barcode => $data->{barcode}, 
                status => 200, 
                success => 'Item updated successfully' 
            }
        );
    }
    catch {
        my $error = $_;
        warn "Error updating item: $error";
        $c->unhandled_exception($_);
    };
}

=head3 checkInItem

Checks in an item using the barcode and date provided

=cut

sub checkInItem {
    my $c = shift->openapi->valid_input or return;

    # Get data from request
    my $data = $c->req->json;

    # Validate required fields
    unless ( $data->{barcode} ) {
        return $c->render(
            status => 400,
            json   => { error => 'Missing barcode' }
        );
    }
    
    unless ( $data->{date} ) {
        return $c->render(
            status => 400,
            json   => { error => 'Missing date' }
        );
    }

    return try {
        # Find the item by barcode
        my $item = Koha::Items->find( { barcode => $data->{barcode} } );
        unless ($item) {
            return $c->render(
                status => 404,
                json   => { error => 'Item not found' }
            );
        }

        my $item_unblessed = $item->unblessed;
        my ($doreturn, $messages, $iteminformation, $borrower) = AddReturn($data->{barcode}, $item->homebranch);
        
        if ($doreturn) {
            $item_unblessed->{onloan} = undef;
            $item_unblessed->{datelastseen} = dt_from_string;
            return $c->render(
                status => 200,
                json   => { success => 'Item checked-in successfully' }
            );
        } else {
            return $c->render(
                status => 500,
                json   => { error => "Failed to check in item" }
            );
        }
    }
    catch {
        my $error = $_;
        $c->unhandled_exception($_);
    };
}

1;