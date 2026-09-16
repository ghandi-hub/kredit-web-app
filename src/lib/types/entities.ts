import type { ObjectId } from 'mongodb';
export interface BaseDocument {
  _id: ObjectId;
  createdAt: Date;
  updatedAt: Date;
  revision?: number;
}
export interface UserDocument extends BaseDocument {
  username: string;
  passwordHash: string;
  name: string;
  role: 'ADMIN';
}
export interface KtpPhoto {
  storageKey: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
}
export interface CustomerDocument extends BaseDocument {
  nik: string;
  name: string;
  dateOfBirth: Date;
  phone: string;
  address: string;
  ktpPhoto: KtpPhoto;
}
export interface CreditDocument extends BaseDocument {
  contractNumber: string;
  customerId: ObjectId;
  supplierName?: string;
  /** Legacy reference, only read to preserve existing supplier names. */
  supplierId?: ObjectId;
  item: { name: string; brand?: string; model?: string; serialNumber?: string; notes?: string };
  purchasePrice: number;
  creditPrice: number;
  markupPercent: number;
  profit: number;
  downPayment: number;
  financedAmount: number;
  tenorMonths: number;
  startDate: Date;
  dueDay: number;
  status: 'ACTIVE' | 'PAID';
}
export interface InstallmentDocument extends BaseDocument {
  creditId: ObjectId;
  sequence: number;
  dueDate: Date;
  amount: number;
  paidAmount: number;
}
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'OTHER';
export interface PaymentDocument {
  _id: ObjectId;
  paymentNumber: string;
  creditId: ObjectId;
  customerId: ObjectId;
  amount: number;
  paymentDate: Date;
  method: PaymentMethod;
  type: 'DOWN_PAYMENT' | 'INSTALLMENT' | 'EARLY_SETTLEMENT';
  allocations: { installmentId: ObjectId; amount: number }[];
  notes?: string;
  createdAt: Date;
  receiptSnapshot?: { creditPrice: number; totalPaid: number; outstanding: number };
}
export interface AuditDocument {
  _id: ObjectId;
  actorId: ObjectId;
  action: string;
  entityType: 'USER' | 'CUSTOMER' | 'SUPPLIER' | 'CREDIT' | 'INSTALLMENT' | 'PAYMENT';
  entityId: ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}
