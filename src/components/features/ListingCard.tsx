import { Heart, MapPin, Eye, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency } from '@/lib/utils';
import { useCurrencyStore } from '@/lib/currencyStore';
import type { Listing } from '@/types';

interface ListingCardProps {
  listing: Listing;
  onFavorite?: (id: string) => void;
}

const conditionConfig = {
  'new': { label: 'New', className: 'bg-emerald-100 text-emerald-700' },
  'like-new': { label: 'Like New', className: 'bg-blue-100 text-blue-700' },
  'good': { label: 'Good', className: 'bg-amber-100 text-amber-700' },
  'fair': { label: 'Fair', className: 'bg-slate-100 text-slate-700' },
};

export default function ListingCard({ listing, onFavorite }: ListingCardProps) {
  const condConf = conditionConfig[listing.condition];
  const { displayCurrency, formatConverted } = useCurrencyStore();
  const showConverted = displayCurrency !== (listing.currency || 'USD');

  return (
    <Link to={`/listing/${listing.id}`} className="group block">
      <div className="bg-white rounded-xl border border-border overflow-hidden hover:shadow-lg hover:border-[hsl(var(--brand-navy))]/20 transition-all duration-200">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {listing.images[0] ? (
            <img
              src={listing.images[0]}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <ShieldCheck className="w-10 h-10 text-muted-foreground/20" />
            </div>
          )}
          {/* Favorite button */}
          {onFavorite && (
            <button
              onClick={(e) => { e.preventDefault(); onFavorite(listing.id); }}
              className="absolute top-3 right-3 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
            >
              <Heart className={cn('w-4 h-4 transition-colors', listing.isFavorited ? 'fill-red-500 text-red-500' : 'text-muted-foreground')} />
            </button>
          )}
          {/* Condition badge */}
          <div className="absolute top-3 left-3">
            <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', condConf.className)}>
              {condConf.label}
            </span>
          </div>
          {/* Escrow protected */}
          <div className="absolute bottom-3 left-3">
            <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 bg-white/90 backdrop-blur-sm rounded-full text-[hsl(var(--brand-navy))]">
              <ShieldCheck className="w-3 h-3 text-[hsl(var(--brand-emerald))]" />
              Escrow Protected
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-heading font-semibold text-sm text-foreground leading-snug line-clamp-2 group-hover:text-[hsl(var(--brand-navy))] transition-colors">
              {listing.title}
            </h3>
          </div>

          <p className="text-xl font-bold text-[hsl(var(--brand-navy))] font-heading mb-3">
            {listing.currency && displayCurrency !== listing.currency
              ? formatConverted(listing.price, listing.currency)
              : formatCurrency(listing.price, listing.currency)}
          </p>
          {listing.currency && displayCurrency !== listing.currency && (
            <p className="text-xs font-medium -mt-2.5 mb-3" style={{ color: '#9A7C40' }}>
              {formatCurrency(listing.price, listing.currency)} {listing.currency}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate max-w-[100px]">{listing.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <Eye className="w-3 h-3" /> {listing.viewCount}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground truncate">{listing.sellerName}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
