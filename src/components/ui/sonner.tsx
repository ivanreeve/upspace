// sonner.tsx
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
        offset={ 80 }
        closeButton
        toastOptions={ {
          className: 'custom-toast',
          style: {
            backdropFilter: 'blur(5px)',
            border: '1px solid var(--custom-red)',
            backgroundColor: 'hsl(var(--sonner-bg-h, 0 0% 100%) / 0.75)',
          },
          // ADD TYPE-SPECIFIC STYLING HERE
          classNames: {
             // These classes will be applied to the main toast container (which has the type data attribute)
             success: 'toast-success-color',
             error: 'toast-error-color',
          }
        } }
        { ...props }
      />
    </>
  );
};
