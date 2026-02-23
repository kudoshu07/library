import { type ContentItem } from "@/lib/data"
import { ContentCard } from "@/components/content-card"

export function PickupSection({ items }: { items: ContentItem[] }) {
  if (items.length === 0) return null

  return (
    <section aria-labelledby="pickup-heading">
      <h2 id="pickup-heading" className="mb-4 text-lg font-bold tracking-tight text-foreground">
        Pickup
      </h2>
      {/* Mobile: horizontal scroll / Desktop: grid */}
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:overflow-visible md:pb-0 scrollbar-none">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} variant="pickup" />
        ))}
      </div>
    </section>
  )
}
