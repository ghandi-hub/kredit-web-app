export interface Column {
  key: string;
  label: string;
  money?: boolean;
}
export interface Row {
  id: string;
  href: string;
  [key: string]: string | number;
}
export interface Field {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: string | number;
  help?: string;
  readonly?: boolean;
  options?: { value: string; label: string }[];
}
export interface AppView {
  kind: 'dashboard' | 'list' | 'form' | 'detail' | 'receipt' | 'reports';
  section: string;
  title: string;
  subtitle: string;
  columns: Column[];
  rows: Row[];
  fields: Field[];
  values: Record<string, string>;
  details: { label: string; value: string }[];
  installments: Row[];
  payments: Row[];
  metrics: { label: string; value: string; note: string }[];
  requestId: string;
  editHref: string;
  createHref: string;
  ktpHref: string;
  canDelete: boolean;
  canPay: boolean;
  locked: boolean;
  paymentHref: string;
  customerPhone: string;
  customerName: string;
  outstanding: number;
  recordId: string;
}
export interface ActionResult {
  message?: string;
  code?: string;
  fields?: Record<string, string>;
  values?: Record<string, string>;
  preview?: { label: string; value: string }[];
  schedule?: { sequence: number; amount: number; dueDate?: string }[];
  success?: boolean;
}
