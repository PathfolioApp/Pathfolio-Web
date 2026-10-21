import React from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Drawer } from '../../../components/ui/Drawer';

// Portalled surfaces need their own scope; they live outside the admin page.
export function AdminModal({ className = '', ...props }) {
  return <Modal {...props} className={`pf-admin-overlay ${className}`} />;
}
export function AdminDrawer({ className = '', ...props }) {
  return <Drawer {...props} className={`pf-admin-overlay ${className}`} />;
}
