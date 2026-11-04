export type NotificationType =
  | "order_created"
  | "order_status_changed"
  | "low_stock"
  | "customer_inquiry"
  | "system_alert";

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

