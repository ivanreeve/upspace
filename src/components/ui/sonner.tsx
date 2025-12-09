import { Toaster as Sonner } from 'sonner';
import type { ToasterProps } from 'sonner';

export const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <>
      <Sonner
        theme="light"
        className="toaster group"
        visibleToasts={ 1 }
        position="top-center"
        offset={ 32 }
        closeButton
        toastOptions={ {
          className: 'custom-toast',
          style: {
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--toast-border)',
            backgroundColor: 'var(--toast-background)',
            boxShadow: 'var(--toast-shadow)',
            color: 'var(--foreground)',
          },
          // ADD TYPE-SPECIFIC STYLING HERE
          classNames: {
             // These classes will be applied to the main toast container (which has the type data attribute)
             success: 'toast-success-color',
             error: 'toast-error-color',
          },
        } }
        { ...props }
      />
    </>
  );
};
