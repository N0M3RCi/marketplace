import { Check, Circle, Clock } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { ESCROW_TIMELINE_STEPS, ESCROW_STATUS_CONFIG } from '@/constants';
import type { EscrowCase, EscrowStatus, TimelineEvent } from '@/types';

interface EscrowTimelineProps {
  escrowCase: EscrowCase;
  compact?: boolean;
}

export default function EscrowTimeline({ escrowCase, compact = false }: EscrowTimelineProps) {
  const currentStep = ESCROW_STATUS_CONFIG[escrowCase.status]?.step ?? 0;
  const isDisputed = escrowCase.status === 'disputed';
  const isRefunded = escrowCase.status === 'refunded';
  const isClosed = escrowCase.status === 'closed';

  if (compact) {
    return <CompactTimeline timeline={escrowCase.timeline} status={escrowCase.status} />;
  }

  return (
    <div className="space-y-1">
      {ESCROW_TIMELINE_STEPS.map((step, idx) => {
        const stepNum = idx + 1;
        const config = ESCROW_STATUS_CONFIG[step];
        const isCompleted = currentStep > stepNum && !isDisputed && !isRefunded;
        const isCurrent = escrowCase.status === step || (currentStep === stepNum && !isDisputed && !isRefunded);
        const isPending = currentStep < stepNum && !isDisputed && !isRefunded;

        const timelineEvent = escrowCase.timeline.find(t => t.status === step);

        return (
          <div key={step} className="flex gap-4">
            {/* Indicator */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all',
                isCompleted && 'bg-[hsl(var(--brand-emerald))] border-[hsl(var(--brand-emerald))]',
                isCurrent && 'bg-[hsl(var(--brand-navy))] border-[hsl(var(--brand-navy))]',
                isPending && 'bg-white border-border',
              )}>
                {isCompleted ? (
                  <Check className="w-4 h-4 text-white" />
                ) : isCurrent ? (
                  <Clock className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Circle className="w-3 h-3 text-muted-foreground/30" />
                )}
              </div>
              {idx < ESCROW_TIMELINE_STEPS.length - 1 && (
                <div className={cn('w-0.5 flex-1 min-h-[20px]', isCompleted ? 'bg-[hsl(var(--brand-emerald))]' : 'bg-border')} />
              )}
            </div>

            {/* Content */}
            <div className={cn('pb-4 flex-1 min-w-0', idx === ESCROW_TIMELINE_STEPS.length - 1 && 'pb-0')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={cn(
                    'text-sm font-medium',
                    isCompleted && 'text-foreground',
                    isCurrent && 'text-[hsl(var(--brand-navy))] font-semibold',
                    isPending && 'text-muted-foreground',
                  )}>
                    {config.label}
                  </p>
                  {timelineEvent && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      by {timelineEvent.actorName} · {formatDateTime(timelineEvent.timestamp)}
                    </p>
                  )}
                  {timelineEvent?.notes && (
                    <p className="text-xs text-muted-foreground/80 mt-0.5 italic">{timelineEvent.notes}</p>
                  )}
                </div>
                {isCurrent && (
                  <span className="text-[11px] font-medium px-2 py-0.5 bg-[hsl(var(--brand-navy))] text-white rounded-full flex-shrink-0">
                    Current
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Special states */}
      {(isDisputed || isRefunded || isClosed) && (
        <div className="flex gap-4 mt-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 bg-red-500 border-red-500">
            <Check className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-600">
              {ESCROW_STATUS_CONFIG[escrowCase.status]?.label}
            </p>
            {escrowCase.timeline.at(-1) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDateTime(escrowCase.timeline.at(-1)!.timestamp)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CompactTimeline({ timeline, status }: { timeline: TimelineEvent[]; status: EscrowStatus }) {
  const recent = [...timeline].reverse().slice(0, 4);
  return (
    <div className="space-y-2">
      {recent.map((event) => {
        const config = ESCROW_STATUS_CONFIG[event.status];
        return (
          <div key={event.id} className="flex items-start gap-2.5">
            <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', config?.bg?.replace('bg-', 'bg-') || 'bg-muted', 'border border-border')} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">{event.label}</p>
              <p className="text-[11px] text-muted-foreground">{event.actorName} · {formatDateTime(event.timestamp)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
