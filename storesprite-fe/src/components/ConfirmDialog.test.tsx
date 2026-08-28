import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog.js';

describe('ConfirmDialog', () => {
  it('renders title and description and fires confirm/cancel callbacks', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmDialog
        open
        title="Confirm Deletion"
        description="Do you want to delete this mapping?"
        confirmLabel="Yes, Delete"
        cancelLabel="No"
        destructive
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    expect(screen.getByText('Confirm Deletion')).toBeInTheDocument();
    expect(screen.getByText('Do you want to delete this mapping?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Yes, Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        title="Hidden"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
  });
});
