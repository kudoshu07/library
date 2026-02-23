export type ContentSource =
  | "blog"
  | "note"
  | "ig_business"
  | "ig_photo"
  | "pod_yonakoi"
  | "pod_vegan"

export interface ContentItem {
  id: string
  source: ContentSource
  title: string
  date: string
  url: string
  year?: string
  month?: string
  day?: string
  slug?: string
  summary?: string
  tags?: string[]
  thumbnail?: string
  body?: string
  isPickUp?: boolean
  pinOrder?: number
  searchText?: string
}

export const sourceLabels: Record<ContentSource, string> = {
  blog: "Blog",
  note: "note(個人)",
  ig_business: "kudoshu_vcook",
  ig_photo: "0n0shu(写真)",
  pod_yonakoi: "よな恋ラジオ",
  pod_vegan: "ヴィーガンの裏側",
}

export const sourceColors: Record<ContentSource, string> = {
  blog: "bg-foreground text-background",
  note: "bg-accent text-accent-foreground",
  ig_business: "bg-secondary text-secondary-foreground border border-border",
  ig_photo: "bg-muted text-foreground",
  pod_yonakoi: "bg-emerald-50 text-emerald-900 border border-emerald-100",
  pod_vegan: "bg-emerald-50 text-emerald-900 border border-emerald-100",
}
