import type { PtsStatus } from '@/lib/pts-status';
import { PTS_STATUS_LABELS } from '@/lib/pts-status';

// Selo do status do PTS com as cores aprovadas (`badge <status>`); sem PTS,
// selo cinza "Sem PTS".
export default function PtsStatusBadge({ status }: { status: PtsStatus | null }) {
  return (
    <span className={`badge ${status ?? 'none'}`}>
      {status ? PTS_STATUS_LABELS[status] : 'Sem PTS'}
    </span>
  );
}
