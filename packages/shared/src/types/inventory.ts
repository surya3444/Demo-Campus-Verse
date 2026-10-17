import { BaseEntity } from './common';

export interface AssetCategory extends BaseEntity {
  branchId: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
}

export interface AssetAssignment {
  userId: string;
  userName: string;
  type: 'staff' | 'department' | 'room';
}

export interface Asset extends BaseEntity {
  branchId: string;
  assetCode: string;
  name: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  location?: string;
  serialNumber?: string;
  modelNumber?: string;
  manufacturer?: string;
  purchaseDate?: Date;
  purchasePrice?: number;
  currentValue?: number;
  warrantyExpiry?: Date;
  condition: 'new' | 'good' | 'fair' | 'poor' | 'damaged' | 'disposed';
  status: 'available' | 'issued' | 'maintenance' | 'disposed' | 'lost';
  assignedTo?: AssetAssignment;
  tags?: string[];
  quantity: number;
  unit: string;
}

export interface ProcurementItem {
  name: string;
  categoryId?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface ProcurementVendor {
  name: string;
  contact?: string;
  email?: string;
}

export interface Procurement extends BaseEntity {
  branchId: string;
  procurementNumber: string;
  title: string;
  description?: string;
  items: ProcurementItem[];
  vendor: ProcurementVendor;
  status: 'draft' | 'submitted' | 'approved' | 'ordered' | 'received' | 'cancelled';
  totalAmount: number;
  approvedBy?: string;
  approvedAt?: Date;
  expectedDate?: Date;
  receivedDate?: Date;
  remarks?: string;
}

export interface AssetIssue extends BaseEntity {
  branchId: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  issuedTo: {
    userId: string;
    userName: string;
    department?: string;
  };
  issuedBy: {
    userId: string;
    userName: string;
  };
  issueDate: Date;
  expectedReturnDate?: Date;
  actualReturnDate?: Date;
  status: 'issued' | 'returned' | 'overdue' | 'lost';
  conditionAtIssue: string;
  conditionAtReturn?: string;
  remarks?: string;
  returnRemarks?: string;
}

export interface InventorySettings extends BaseEntity {
  branchId: string;
  autoGenerateAssetCode: boolean;
  assetCodePrefix: string;
  requireApprovalForProcurement: boolean;
  defaultUnit: string;
}
