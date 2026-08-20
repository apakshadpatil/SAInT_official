import { useState } from 'react';
import type { EventRecord } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Upload, Eye, Trash2 } from 'lucide-react';
import { uploadDataUrlToSupabase } from '../../utils/supabase';

interface TicketDesignTabProps {
  event: EventRecord;
  onUpdate: (updates: Partial<EventRecord>) => Promise<void>;
  canEdit: boolean;
}

export default function TicketDesignTab({ event, onUpdate, canEdit }: TicketDesignTabProps) {
  const { showToast } = useToast();
  const [designImagePreview, setDesignImagePreview] = useState<string>(event.ticketDesignImageUrl || '');
  const [loading, setLoading] = useState(false);
  const [previewData] = useState({
    guestName: 'John Doe',
    transactionId: 'TXN123456789',
    ticketNumber: 'EVT-001',
  });

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be smaller than 5MB', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      setDesignImagePreview(preview);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDesign = async () => {
    if (!designImagePreview) {
      showToast('Please upload a design image', 'error');
      return;
    }

    setLoading(true);
    try {
      let finalUrl = designImagePreview;
      if (designImagePreview.startsWith('data:')) {
        const dest = `tickets/designs/${event.id}_${Date.now()}.png`;
        finalUrl = await uploadDataUrlToSupabase(designImagePreview, dest, 'ticket_design.png', 'banners');
      }

      await onUpdate({
        ticketDesignImageUrl: finalUrl,
      });
      setDesignImagePreview(finalUrl);
      showToast('Ticket design uploaded to Supabase & saved successfully', 'success');
    } catch (err) {
      console.error('Failed to save ticket design:', err);
      showToast('Failed to save ticket design', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDesign = async () => {
    if (!window.confirm('Remove the ticket design?')) return;

    setLoading(true);
    try {
      await onUpdate({
        ticketDesignImageUrl: undefined,
      });
      setDesignImagePreview('');
      showToast('Ticket design removed', 'success');
    } catch (err) {
      showToast('Failed to remove ticket design', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {!designImagePreview ? (
        /* Upload Section */
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--dash-border)' }}>
          <label className="inline-block cursor-pointer">
            <div className="space-y-3">
              <Upload className="w-12 h-12 mx-auto" style={{ color: 'var(--dash-muted)' }} />
              <div>
                <p className="font-semibold" style={{ color: 'var(--dash-text)' }}>
                  Upload Ticket Design
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--dash-muted)' }}>
                  PNG or JPG image (recommended: 1920x1080px)
                </p>
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
              className="hidden"
              disabled={!canEdit}
            />
          </label>
        </div>
      ) : (
        /* Preview and Save Section */
        <div className="space-y-6">
          {/* Image Preview */}
          <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--dash-border)' }}>
            <h4 className="font-semibold" style={{ color: 'var(--dash-text)' }}>Design Preview</h4>
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--dash-border)' }}>
              <img
                src={designImagePreview}
                alt="Ticket Design"
                className="w-full h-auto max-h-64 object-cover"
              />
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveDesign}
                  disabled={loading}
                  className="btn-primary flex-1"
                >
                  {loading ? 'Saving...' : 'Save Design'}
                </button>
                <button
                  onClick={handleRemoveDesign}
                  disabled={loading}
                  className="btn-secondary flex-1 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Information */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
            <h4 className="font-semibold mb-3" style={{ color: 'var(--dash-text)' }}>Design Guidelines</h4>
            <ul className="space-y-2 text-sm" style={{ color: 'var(--dash-muted)' }}>
              <li>✓ Recommended resolution: 1920x1080 pixels</li>
              <li>✓ Aspect ratio: 16:9 (landscape orientation)</li>
              <li>✓ File size: Maximum 5MB</li>
              <li>✓ Format: PNG or JPG</li>
              <li>✓ Leave space for overlaid participant information</li>
              <li>✓ Use high contrast designs for better readability</li>
            </ul>
          </div>

          {/* Preview Information */}
          <div className="rounded-2xl border p-6" style={{ borderColor: 'var(--dash-border)' }}>
            <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--dash-text)' }}>
              <Eye className="w-5 h-5" />
              Information Overlay Preview
            </h4>
            <p className="text-sm mb-4" style={{ color: 'var(--dash-muted)' }}>
              The following information will be overlaid on each participant's ticket:
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--dash-card)' }}>
                <span style={{ color: 'var(--dash-muted)' }}>Participant Name:</span>
                <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>
                  {previewData.guestName}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--dash-card)' }}>
                <span style={{ color: 'var(--dash-muted)' }}>Ticket Number:</span>
                <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>
                  {previewData.ticketNumber}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--dash-card)' }}>
                <span style={{ color: 'var(--dash-muted)' }}>Transaction ID:</span>
                <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>
                  {previewData.transactionId}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ background: 'var(--dash-card)' }}>
                <span style={{ color: 'var(--dash-muted)' }}>QR Code:</span>
                <span className="font-semibold" style={{ color: 'var(--dash-text)' }}>
                  [QR Code]
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Change Design */}
      {designImagePreview && canEdit && (
        <button
          onClick={() => setDesignImagePreview('')}
          className="btn-secondary w-full"
        >
          Change Design
        </button>
      )}
    </div>
  );
}
