export type ThreadsMediaType =
  | "TEXT_POST"
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "CAROUSEL_ALBUM"
  | "AUDIO"
  | "REPOST_FACADE";

export interface ThreadsUser {
  id: string;
  username?: string;
  name?: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
}

export interface ThreadsPost {
  id: string;
  text?: string;
  media_type?: ThreadsMediaType;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  username?: string;
  is_quote_post?: boolean;
}

export interface ThreadsInsightsValue {
  value: number;
}

export interface ThreadsInsightsMetric {
  name: string;
  period: string;
  values: ThreadsInsightsValue[];
  total_value?: { value: number };
}

export interface ThreadsInsightsResponse {
  data: ThreadsInsightsMetric[];
}

export interface ThreadsPaging {
  cursors?: { before?: string; after?: string };
  next?: string;
  previous?: string;
}

export interface ThreadsListResponse<T> {
  data: T[];
  paging?: ThreadsPaging;
}
