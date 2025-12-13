export type Tab = "balance" | "expenses";

export type InviteInfo = {
  id: string;
  name: string;
  currency: string;
  membersCount: number;
  inviteCode: string;
};

export interface ScanItem {
  id: string;
  name: string;
  quantity: number;
  totalPrice: number;
  unitPrice?: number;
  distribution: Record<string, number>;
  needsReview?: boolean;
}

export interface ScanResult {
  amount?: number;
  currency?: string;
  date?: string;
  description?: string;
  items: ScanItem[];
  warnings?: string[];
}

export type ScanStep = "select" | "processing" | "edit" | "distribute" | "confirm";

