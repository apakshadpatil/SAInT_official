import { useEffect, useState } from 'react';
import { Star, MessageSquare, Loader2, Sliders } from 'lucide-react';
import type { ApplicationRating, GDRubric } from '../../types';
import { subscribeRubrics, submitRubricEvaluation } from '../../services/rubricService';

interface PanelRatingCardProps {
  applicationId: string;
  applicationName: string;
  panelId: string;
  panelName: string;
  currentPanellistId: string;
  currentPanellistName: string;
  rating: ApplicationRating | null;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
}

export default function PanelRatingCard({
  applicationId,
  applicationName,
  panelId,
  panelName,
  currentPanellistId,
  currentPanellistName,
  rating,
  onSubmit,
}: PanelRatingCardProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [loading, setLoading] = useState(false);

  const [rubrics, setRubrics] = useState<GDRubric[]>([]);
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [showRubrics, setShowRubrics] = useState(false);

  useEffect(() => {
    const unsub = subscribeRubrics(setRubrics);
    return () => unsub();
  }, []);

  // Get current user's rating if exists
  const currentRating = rating?.ratings.find((r) => r.panellistId === currentPanellistId);
  if (currentRating) {
    if (selectedRating === 0) setSelectedRating(currentRating.rating);
    if (!comment && currentRating.comment) setComment(currentRating.comment);
  }

  const handleRubricScoreChange = (rubricId: string, val: number) => {
    setRubricScores((prev) => ({
      ...prev,
      [rubricId]: val,
    }));
  };

  const handleSubmit = async () => {
    if (selectedRating === 0) {
      alert('Please select a rating');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(selectedRating, comment);

      // Also submit custom rubric evaluation if rubrics are filled
      if (Object.keys(rubricScores).length > 0 && rubrics.length > 0) {
        await submitRubricEvaluation(
          applicationId,
          currentPanellistId,
          currentPanellistName,
          rubricScores,
          rubrics,
          comment,
          panelId
        ).catch(() => {});
      }

      alert('Rating submitted successfully!');
      setComment('');
      setShowComment(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4 border-b pb-4">
        <h3 className="font-semibold text-slate-900">{applicationName}</h3>
        <p className="text-sm text-slate-500">{panelName}</p>
      </div>

      {/* All Ratings Display */}
      <div className="mb-6">
        <p className="mb-3 text-sm font-medium text-slate-700">Panel Ratings:</p>
        {rating && rating.ratings.length > 0 ? (
          <div className="space-y-2">
            {rating.ratings.map((r) => (
              <div
                key={r.panellistId}
                className={`flex items-center justify-between rounded-lg p-3 ${
                  r.panellistId === currentPanellistId ? 'bg-blue-50' : 'bg-slate-50'
                }`}
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {r.panellistName} {r.panellistId === currentPanellistId && <span className="text-xs text-blue-600">(You)</span>}
                  </p>
                  {r.comment && <p className="mt-1 text-xs text-slate-600 italic">{r.comment}</p>}
                </div>
                <div className="ml-4 flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-4 w-4"
                      fill={i < r.rating ? '#3b82f6' : '#e2e8f0'}
                      color={i < r.rating ? '#3b82f6' : '#cbd5e1'}
                    />
                  ))}
                  <span className="ml-2 text-sm font-semibold text-slate-900">{r.rating}/5</span>
                </div>
              </div>
            ))}

            {/* Average Rating */}
            <div className="mt-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-600">Average Rating</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5"
                      fill={i < Math.round(rating.averageRating) ? '#3b82f6' : '#e2e8f0'}
                      color={i < Math.round(rating.averageRating) ? '#3b82f6' : '#cbd5e1'}
                    />
                  ))}
                </div>
                <span className="font-bold text-slate-900">{rating.averageRating.toFixed(1)}/5</span>
                <span className="text-sm text-slate-600">({rating.totalRaters} panelist{rating.totalRaters !== 1 ? 's' : ''})</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 p-3 text-center text-sm text-slate-500">No ratings yet</div>
        )}
      </div>

      {/* Your Rating Section */}
      <div className="border-t pt-4">
        <p className="mb-4 text-sm font-medium text-slate-700">Your Rating:</p>

        {/* Star Rating */}
        <div className="mb-4 flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setSelectedRating(star)}
              className="transition-transform hover:scale-110"
              title={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <Star
                className="h-8 w-8 transition-colors"
                fill={star <= (hoverRating || selectedRating) ? '#fbbf24' : '#e2e8f0'}
                color={star <= (hoverRating || selectedRating) ? '#f59e0b' : '#cbd5e1'}
              />
            </button>
          ))}
          {selectedRating > 0 && <span className="ml-2 self-center text-sm font-semibold text-slate-900">{selectedRating}/5</span>}
        </div>

        {/* Custom Assessment Rubrics Toggle */}
        {rubrics.length > 0 && (
          <div className="mb-4 border rounded-lg p-3 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setShowRubrics(!showRubrics)}
              className="flex items-center justify-between w-full text-xs font-semibold text-indigo-700 hover:text-indigo-800"
            >
              <span className="flex items-center gap-1.5">
                <Sliders className="h-4 w-4" />
                Custom Rubrics Assessment ({rubrics.length} parameters)
              </span>
              <span>{showRubrics ? 'Hide' : 'Expand'}</span>
            </button>

            {showRubrics && (
              <div className="mt-3 space-y-3 pt-3 border-t">
                {rubrics.map((rubric) => (
                  <div key={rubric.id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-slate-800">{rubric.title}</p>
                      <p className="text-[10px] text-slate-500">Max: {rubric.maxMarks} marks</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={rubric.maxMarks}
                      value={rubricScores[rubric.id] || 0}
                      onChange={(e) =>
                        handleRubricScoreChange(rubric.id, Math.min(rubric.maxMarks, Math.max(0, Number(e.target.value))))
                      }
                      className="w-16 rounded border border-slate-300 p-1 text-center text-xs font-bold focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Comment Toggle */}
        <button
          onClick={() => setShowComment(!showComment)}
          className="mb-4 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
        >
          <MessageSquare className="h-4 w-4" />
          {showComment ? 'Hide' : 'Add'} Comment (Optional)
        </button>

        {/* Comment Input */}
        {showComment && (
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add optional feedback or comments..."
            className="mb-4 w-full rounded-lg border border-slate-300 p-3 text-sm font-normal focus:border-blue-500 focus:outline-none"
            rows={3}
            maxLength={200}
          />
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={loading || selectedRating === 0}
          className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 font-semibold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Submitting...' : currentRating ? 'Update Rating' : 'Submit Rating'}
        </button>
      </div>
    </div>
  );
}
