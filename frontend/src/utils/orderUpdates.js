// Module 21: labels shared by the AI Order Inbox "Order Updates" tab and its review page
export const UPDATE_TYPE_LABELS = {
  confirmed: 'Confirmed',
  processing: 'Processing',
  'ready-dispatch': 'Ready for Dispatch',
  dispatched: 'Dispatched',
  'in-transit': 'In Transit',
  delivered: 'Delivered',
  delayed: 'Delayed',
  cancelled: 'Cancelled',
  other: 'Other update',
};

// Update types that move a shipment (the rest change the order's own status)
export const SHIPMENT_UPDATE_TYPES = ['ready-dispatch', 'dispatched', 'in-transit', 'delivered', 'delayed'];

export const MATCH_LABELS = {
  po: 'PO number',
  tracking: 'LR / AWB / GR number',
  thread: 'Same email thread',
  party: 'Customer / supplier and product',
};

// Badge class for an update type (existing status-badge colours)
export const updateTypeBadge = (type) => (UPDATE_TYPE_LABELS[type] && type !== 'other' ? type : 'processing');
