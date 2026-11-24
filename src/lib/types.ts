// Lo que devuelven driver_status(), trip_for_driver() y driver_earnings() (supabase/002_plataforma.sql del panel)

export type DriverStatus =
  | { registered: false }
  | {
      registered: true;
      status: "pending" | "approved" | "suspended";
      online: boolean;
      vehicle: { id: string; kind: string; plate: string | null; status: string; usable: boolean } | null;
      subscription_ok: boolean;
      subscription_until: string | null;
      internal_brands: string[];
      invites: { id: string; brand: string; branch: string | null }[];
      missing_docs: string[];
      rejected_docs: string[];
      tax_ok: boolean;
      destination: boolean;
      destination_point: { lat: number; lng: number } | null;
      destination_uses_left: number;
      offer: { trip_id: string; expires_in: number } | null;
      active_trips: string[];
      today: { trips: number; earned: number };
      balance: number;
    };

export type Registered = Extract<DriverStatus, { registered: true }>;

export type Stop = {
  seq: number;
  kind: "pickup" | "dropoff";
  address: string;
  lat: number;
  lng: number;
  contact_name: string | null;
  contact_phone: string | null;
  notes: string | null;
  arrived_at: string | null;
  done_at: string | null;
};

export type TripDetail = {
  id: string;
  kind: "food" | "grocery" | "pharmacy" | "parcel" | "ride" | "business";
  status: "scheduled" | "searching" | "assigned" | "arriving" | "in_progress" | "completed" | "canceled";
  service: string;
  mine: boolean;
  fare: number;
  extra_charges: number;
  tip: number;
  discount: number;
  payment_method: "card" | "cash";
  cash_to_collect: number | null;
  pay_store: number | null;
  cash_status: string | null;
  cash_received: number | null;
  distance_m: number | null;
  duration_s: number | null;
  scheduled_for: string | null;
  internal: boolean;
  created_at: string;
  assigned_at: string | null;
  free_wait_min: number;
  passenger: { name: string | null; phone: string | null } | null;
  danger: boolean;
  stops: Stop[];
  order: {
    id: string;
    code: string;
    status: string;
    brand: string;
    branch: string;
    customer: string | null;
    subtotal: number;
    total: number;
    notes: string | null;
    ready_eta: string | null;
    requires_purchase: boolean;
    purchase_status: string | null;
    purchase_max: number;
    items: { name: string; qty: number; options: { name?: string }[] | null }[];
  } | null;
  batch: string[];
  pending_change: { id: string; kind: "add_stop" | "change_destination"; address: string } | null;
  open_pause: { id: string; started_at: string; accepted: boolean | null } | null;
};

export type Earnings = {
  earned: number;
  tips: number;
  withheld: number;
  owner_share: number;
  cash_collected: number;
  net: number;
  trips: number;
  days: { day: string; earned: number | null; net: number; trips: number }[];
  entries: { at: string; kind: string; amount: number; trip_id: string | null; note: string | null }[];
  balance: number;
};

export type Membership = {
  plan: { id: string; name: string; price_month: number; grace_days: number } | null;
  ok: boolean;
  internal: boolean;
  until: string | null;
  payments: { at: string; until: string; method: "online" | "dlux" }[];
};
