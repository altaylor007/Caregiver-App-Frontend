import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export default function ExpensesPage() {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resubmitFrom, setResubmitFrom] = useState(null);
  const [noReceiptReason, setNoReceiptReason] = useState('');

  const loadExpenses = async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from('expenses')
      .select('id, amount, description, receipt_url, status, rejection_reason, submitted_at, resubmitted_from')
      .eq('user_id', user.id)
      .order('submitted_at', { ascending: false });
    if (e) setError(e.message);
    else setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    setError('');
    setSuccess('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError('Enter a valid amount greater than 0.');
      return;
    }
    if (!description.trim()) {
      setError('Please add a description.');
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      setError('Receipt image must be under 10 MB.');
      return;
    }
    if (!file && !noReceiptReason.trim()) {
      setError("Please attach a receipt, or explain why you don't have one.");
      return;
    }
    setSubmitting(true);
    try {
      let receiptPath = null;
      if (file) {
        const ext = file.name.split('.').pop();
        receiptPath = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(receiptPath, file, { contentType: file.type || 'application/octet-stream' });
        if (upErr) throw new Error(`Receipt upload failed: ${upErr.message}`);
      }
      const { error: insErr } = await supabase.from('expenses').insert([{
        user_id: user.id,
        amount: amt,
        description: description.trim(),
        receipt_url: receiptPath,
        source: 'app',
        resubmitted_from: resubmitFrom,
        no_receipt_reason: receiptPath ? null : noReceiptReason.trim()
      }]);
      if (insErr) throw new Error(insErr.message);
      setSuccess(resubmitFrom ? 'Expense resubmitted.' : 'Expense submitted.');
      setAmount('');
      setDescription('');
      setFile(null);
      setResubmitFrom(null);
      setNoReceiptReason('');
      loadExpenses();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const startResubmit = (x) => {
    setResubmitFrom(x.id);
    setAmount(String(x.amount));
    setDescription(x.description);
    setFile(null);
    setError('');
    setSuccess('');
    setNoReceiptReason('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelResubmit = () => {
    setResubmitFrom(null);
    setAmount('');
    setDescription('');
    setFile(null);
    setNoReceiptReason('');
  };

  const viewReceipt = async (path) => {
    const { data, error: e } = await supabase.storage.from('receipts').createSignedUrl(path, 60);
    if (e) {
      setError(e.message);
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const statusLabel = (s) =>
    s === 'reimbursed' ? 'Reimbursed' : s === 'rejected' ? 'Declined' : 'Submitted';

  const resubmittedIds = new Set(expenses.map(e => e.resubmitted_from).filter(Boolean));

  return (
    <div className="page-container">
      <h2>Expenses</h2>

      <div className="card">
        <h3>Submit an Expense</h3>
        <form onSubmit={handleSubmit}>
            {resubmitFrom && (
              <div className="text-sm" style={{ marginBottom: '0.75rem' }}>
                Amending a declined expense.{' '}
                <button type="button" className="btn btn-outline" style={{ padding: '0.1rem 0.4rem', fontSize: '0.75rem' }} onClick={cancelResubmit}>Cancel</button>
              </div>
            )}
          <div className="form-group">
            <label className="form-label">Amount ($)</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What was this for?"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Receipt</label>
            <input
              className="form-input"
              type="file"
              accept="image/*"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>
          {!file && (
            <div className="form-group">
              <label className="form-label">Reason for no receipt (required if no receipt attached)</label>
              <textarea
                className="form-input"
                rows={2}
                value={noReceiptReason}
                onChange={e => setNoReceiptReason(e.target.value)}
                placeholder="e.g. Receipt was lost / vendor didn't provide one"
              />
            </div>
          )}
          {error && <p className="text-danger">{error}</p>}
          {success && <p className="text-success">{success}</p>}
          <button className="btn btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit expense'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3>Your Submitted Expenses</h3>
        {loading ? (
          <p className="text-neutral-muted">Loading…</p>
        ) : expenses.length === 0 ? (
          <p className="text-neutral-muted">No expenses yet.</p>
        ) : (
          <div>
            {expenses.map(x => (
              <div key={x.id} className="form-group">
                <div>
                  <strong>${Number(x.amount).toFixed(2)}</strong> — {x.description}
                </div>
                <div className="text-sm text-neutral-muted">
                  {new Date(x.submitted_at).toLocaleDateString()} · {statusLabel(x.status)}
                </div>
                {x.status === 'rejected' && x.rejection_reason && (
                  <div className="text-sm text-danger">Reason: {x.rejection_reason}</div>
                )}
                {x.status === 'rejected' && (
                  resubmittedIds.has(x.id) ? (
                    <div className="text-sm text-neutral-muted">Resubmitted</div>
                  ) : (
                    <div>
                      <button type="button" className="btn btn-outline" onClick={() => startResubmit(x)}>
                        Amend &amp; resubmit
                      </button>
                    </div>
                  )
                )}
                {x.receipt_url && (
                  <div>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() => viewReceipt(x.receipt_url)}
                    >
                      View receipt
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
