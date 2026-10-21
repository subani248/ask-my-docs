import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { AVAILABLE_LANGUAGES } from '../i18n/translations'
import { apiExportData, apiChangePassword, apiDeleteAccount } from '../services/api'

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
    </button>
  )
}

export default function Settings() {
  const { user, updateProfile } = useAuth()
  const { darkMode, language, toggleDarkMode, setLanguage, t } = useTheme()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.full_name || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Password modal
  const [pwOpen, setPwOpen] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)

  // Delete account modal
  const [delOpen, setDelOpen] = useState(false)
  const [delConfirm, setDelConfirm] = useState('')
  const [delLoading, setDelLoading] = useState(false)
  const [delError, setDelError] = useState('')

  useEffect(() => { if (user?.full_name) setName(user.full_name) }, [user?.full_name])

  const handleSave = async () => {
    if (!name.trim()) { setError('Name cannot be empty'); return }
    setSaving(true); setError(''); setSuccess('')
    try { await updateProfile(name.trim()); setSuccess(t('profileUpdated')); setEditing(false); setTimeout(() => setSuccess(''), 3000) }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed') }
    finally { setSaving(false) }
  }

  const handleCancel = () => { setName(user?.full_name || ''); setEditing(false); setError('') }
  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000) }

  const handleExport = async () => {
    try { await apiExportData(); showSuccess('Data exported successfully!') }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Export failed') }
  }

  const handleDeleteAccount = async () => {
    setDelError('')
    if (delConfirm !== 'DELETE') { setDelError('Type DELETE to confirm'); return }
    setDelLoading(true)
    try {
      await apiDeleteAccount()
      window.location.href = '/'
    } catch (err: unknown) {
      setDelError(err instanceof Error ? err.message : 'Failed to delete account')
      setDelLoading(false)
    }
  }

  const closeDelModal = () => { setDelOpen(false); setDelConfirm(''); setDelError(''); setDelLoading(false) }

  const handleChangePassword = async () => {
    setPwError(''); setPwSuccess('')
    if (!currentPw || !newPw || !confirmPw) { setPwError('All fields are required'); return }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { setPwError('New passwords do not match'); return }
    if (currentPw === newPw) { setPwError('New password must be different from current'); return }
    setPwLoading(true)
    try {
      await apiChangePassword(currentPw, newPw)
      setPwSuccess('Password changed successfully!')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => { setPwOpen(false); setPwSuccess('') }, 2000)
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Failed to change password')
    } finally { setPwLoading(false) }
  }

  const closePwModal = () => { setPwOpen(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError(''); setPwSuccess(''); setShowCurrentPw(false); setShowNewPw(false); setShowConfirmPw(false) }

  const card = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
  const textStrong = darkMode ? 'text-zinc-900 dark:text-white' : 'text-gray-900'
  const text = darkMode ? 'text-zinc-500' : 'text-gray-500'
  const inputBg = darkMode ? 'bg-gray-700 border-gray-600 text-zinc-900 dark:text-white' : 'bg-gray-50 border-gray-200 text-gray-700'
  const rowBg = darkMode ? 'bg-gray-700' : 'bg-gray-50'

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textStrong}`}>{t('settingsTitle')}</h1>
          <p className={`mt-1 text-sm ${text}`}>{t('settingsDesc')}</p>
        </div>
      </div>

      {/* Profile */}
      <div className={`${card} rounded-2xl border p-6 mb-5 transition-colors`}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg">👤</div>
            <div><h2 className={`font-bold ${textStrong}`}>{t('profile')}</h2><p className={`text-xs ${text}`}>{t('profileDesc')}</p></div>
          </div>
          {!editing && <button onClick={() => setEditing(true)} className={`flex items-center gap-2 rounded-xl border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'} px-4 py-2 text-xs font-medium transition-all`}>✏️ {t('editProfile')}</button>}
          {editing && <div className="flex items-center gap-2">
            <button onClick={handleCancel} className={`rounded-xl border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'} px-4 py-2 text-xs font-medium transition-all`}>{t('cancel')}</button>
            <button onClick={handleSave} disabled={saving} className="rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 text-xs font-medium text-zinc-900 dark:text-white hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-all">{saving ? t('saving') : t('saveChanges')}</button>
          </div>}
        </div>
        {error && <div className="mb-4 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">{error}</div>}
        {success && <div className="mb-4 p-2.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-700 text-center">{success}</div>}
        <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
          <div className="flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-xl ${rowBg} flex items-center justify-center text-base text-zinc-500`}>👤</div>
            <div className="flex-1"><p className={`text-sm font-semibold ${textStrong}`}>{t('name')}</p><p className={`text-xs ${text}`}>{t('nameDesc')}</p></div>
            {editing ? <input type="text" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()} className={`w-64 rounded-xl border border-purple-300 bg-purple-50/50 px-3 py-2 text-sm ${darkMode ? 'text-zinc-900 dark:text-white' : 'text-gray-900'} outline-none focus:ring-2 focus:ring-zinc-200 dark:ring-zinc-800 transition-all`} autoFocus />
              : <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{user?.full_name}</p>}
          </div>
          <div className="flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-xl ${rowBg} flex items-center justify-center text-base text-zinc-500`}>✉️</div>
            <div className="flex-1"><p className={`text-sm font-semibold ${textStrong}`}>{t('email')}</p><p className={`text-xs ${text}`}>{t('emailDesc')}</p></div>
            <p className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>{user?.email}</p>
          </div>
          <div className="flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-xl ${rowBg} flex items-center justify-center text-base text-zinc-500`}>🛡️</div>
            <div className="flex-1"><p className={`text-sm font-semibold ${textStrong}`}>{t('role')}</p><p className={`text-xs ${text}`}>{t('roleDesc')}</p></div>
            <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-semibold text-purple-700 capitalize">{user?.role}</span>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className={`${card} rounded-2xl border p-6 mb-5 transition-colors`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-lg">🔐</div>
          <div><h2 className={`font-bold ${textStrong}`}>{t('security')}</h2><p className={`text-xs ${text}`}>{t('securityDesc')}</p></div>
        </div>
        <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
          <div className="flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-xl ${rowBg} flex items-center justify-center text-base text-zinc-500`}>🔑</div>
            <div className="flex-1">
              <p className={`text-sm font-semibold ${textStrong}`}>{t('password')}</p>
              {user?.google_id ? (
                <p className={`text-xs ${text}`}>Your account uses Google Sign-In</p>
              ) : (
                <p className={`text-xs ${text}`}>{t('lastChanged')}</p>
              )}
            </div>
            {user?.google_id ? (
              <span className={`rounded-full ${darkMode ? 'bg-gray-600 text-zinc-500' : 'bg-gray-100 text-gray-500'} px-3 py-1 text-[10px] font-semibold`}>N/A — Google Auth</span>
            ) : (
              <button onClick={() => setPwOpen(true)} className={`rounded-xl border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'} px-4 py-2 text-xs font-medium transition-all`}>{t('changePassword')}</button>
            )}
          </div>
          <div className="flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-xl ${rowBg} flex items-center justify-center text-base text-zinc-500`}>📱</div>
            <div className="flex-1"><p className={`text-sm font-semibold ${textStrong}`}>{t('twoFactor')}</p><p className={`text-xs ${text}`}>{t('twoFactorDesc')}</p></div>
            <span className={`rounded-full ${darkMode ? 'bg-gray-600 text-zinc-500' : 'bg-gray-100 text-gray-500'} px-3 py-1 text-[10px] font-semibold`}>{t('comingSoon')}</span>
          </div>
          <div className="flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-xl ${rowBg} flex items-center justify-center text-base text-zinc-500`}>🔗</div>
            <div className="flex-1"><p className={`text-sm font-semibold ${textStrong}`}>{t('connectedAccounts')}</p><p className={`text-xs ${text}`}>{t('connectedDesc')}</p></div>
            {user?.google_id ? (
              <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google ✓
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                ✉️ Email ✓
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className={`${card} rounded-2xl border p-6 mb-5 transition-colors`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-lg">🎨</div>
          <div><h2 className={`font-bold ${textStrong}`}>{t('appearance')}</h2><p className={`text-xs ${text}`}>{t('appearanceDesc')}</p></div>
        </div>
        <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
          <div className="flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-xl ${rowBg} flex items-center justify-center text-base text-zinc-500`}>{darkMode ? '🌙' : '☀️'}</div>
            <div className="flex-1"><p className={`text-sm font-semibold ${textStrong}`}>{t('darkMode')}</p><p className={`text-xs ${text}`}>{t('darkModeDesc')} {darkMode ? t('dark') : t('light')} {t('mode')}</p></div>
            <Toggle enabled={darkMode} onChange={toggleDarkMode} />
          </div>
          <div className="flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-xl ${rowBg} flex items-center justify-center text-base text-zinc-500`}>🌐</div>
            <div className="flex-1"><p className={`text-sm font-semibold ${textStrong}`}>{t('language')}</p><p className={`text-xs ${text}`}>{t('languageDesc')} {AVAILABLE_LANGUAGES.find(l => l.code === language)?.label}</p></div>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`rounded-xl border ${inputBg} px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-zinc-200 dark:ring-zinc-800`}>
              {AVAILABLE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Data & Privacy */}
      <div className={`${card} rounded-2xl border p-6 transition-colors`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-lg">🛡️</div>
          <div><h2 className={`font-bold ${textStrong}`}>{t('dataPrivacy')}</h2><p className={`text-xs ${text}`}>{t('dataPrivacyDesc')}</p></div>
        </div>
        <div className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-100'}`}>
          <div className="flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-xl ${rowBg} flex items-center justify-center text-base text-zinc-500`}>📥</div>
            <div className="flex-1"><p className={`text-sm font-semibold ${textStrong}`}>{t('exportData')}</p><p className={`text-xs ${text}`}>{t('exportDesc')}</p></div>
            <button onClick={handleExport} className={`rounded-xl border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'} px-4 py-2 text-xs font-medium transition-all`}>{t('exportBtn')}</button>
          </div>
          <div className="flex items-center gap-4 py-4">
            <div className={`w-10 h-10 rounded-xl ${rowBg} flex items-center justify-center text-base text-zinc-500`}>🗑️</div>
            <div className="flex-1"><p className={`text-sm font-semibold ${textStrong}`}>{t('deleteAccount')}</p><p className={`text-xs ${text}`}>{t('deleteDesc')}</p></div>
            <button onClick={() => setDelOpen(true)} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-100 transition-all">{t('deleteBtn')}</button>
          </div>
        </div>
      </div>

      {/* ── Change Password Modal ──────────────────── */}
      {pwOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closePwModal} />
          <div className={`relative w-full max-w-md rounded-2xl shadow-2xl p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-lg">🔑</div>
                <h3 className={`text-lg font-bold ${textStrong}`}>Change Password</h3>
              </div>
              <button onClick={closePwModal} className={`text-xl ${text} hover:text-gray-900 dark:hover:text-zinc-900 dark:text-white`}>✕</button>
            </div>

            {pwError && <div className="mb-4 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">{pwError}</div>}
            {pwSuccess && <div className="mb-4 p-2.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-700 text-center">{pwSuccess}</div>}

            {user?.google_id ? (
              <div className="py-6 text-center">
                <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-2xl mx-auto mb-3">🔗</div>
                <p className={`text-sm font-semibold ${textStrong} mb-1`}>Google Account</p>
                <p className={`text-xs ${text}`}>Your account is linked to Google Sign-In. Password management is handled by Google.</p>
                <div className="mt-5">
                  <button onClick={closePwModal} className={`rounded-xl border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'} px-6 py-2.5 text-sm font-medium transition-all`}>Close</button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className={`block text-xs font-semibold ${textStrong} mb-1.5`}>Current Password</label>
                    <div className="relative">
                      <input type={showCurrentPw ? 'text' : 'password'} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                        className={`w-full rounded-xl border ${inputBg} px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-zinc-200 dark:ring-zinc-800`}
                        placeholder="Enter current password" />
                      <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${darkMode ? 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 hover:text-gray-600'}`}>
                        {showCurrentPw ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${textStrong} mb-1.5`}>New Password</label>
                    <div className="relative">
                      <input type={showNewPw ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)}
                        className={`w-full rounded-xl border ${inputBg} px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-zinc-200 dark:ring-zinc-800`}
                        placeholder="Enter new password (min 8 chars)" />
                      <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${darkMode ? 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 hover:text-gray-600'}`}>
                        {showNewPw ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold ${textStrong} mb-1.5`}>Confirm New Password</label>
                    <div className="relative">
                      <input type={showConfirmPw ? 'text' : 'password'} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                        className={`w-full rounded-xl border ${inputBg} px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-zinc-200 dark:ring-zinc-800`}
                        placeholder="Confirm new password" />
                      <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm ${darkMode ? 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-300' : 'text-zinc-500 hover:text-gray-600'}`}>
                        {showConfirmPw ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-6">
                  <button onClick={closePwModal} className={`flex-1 rounded-xl border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'} px-4 py-2.5 text-sm font-medium transition-all`}>Cancel</button>
                  <button onClick={handleChangePassword} disabled={pwLoading}
                    className="flex-1 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-all">
                    {pwLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Delete Account Modal ──────────────────── */}
      {delOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={closeDelModal} />
          <div className={`relative w-full max-w-md rounded-2xl shadow-2xl p-6 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-lg">⚠️</div>
                <h3 className="text-lg font-bold text-red-600">Delete Account</h3>
              </div>
              <button onClick={closeDelModal} className={`text-xl ${text} hover:text-gray-900 dark:hover:text-zinc-900 dark:text-white`}>✕</button>
            </div>

            <div className="mb-5">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                <span className="text-lg mt-0.5">🗑️</span>
                <div>
                  <p className="text-sm font-semibold text-red-700">This action is permanent and cannot be undone.</p>
                  <p className="text-xs text-red-600 mt-1">All your documents, chunks, and data will be permanently deleted.</p>
                </div>
              </div>
              <p className={`text-xs ${text} mb-3`}>Type <span className="font-mono font-bold text-red-600">DELETE</span> to confirm:</p>
              <input type="text" value={delConfirm} onChange={(e) => setDelConfirm(e.target.value)}
                className={`w-full rounded-xl border ${inputBg} px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500 focus:border-red-400`} 
                placeholder="Type DELETE" autoFocus />
            </div>

            {delError && <div className="mb-4 p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 text-center">{delError}</div>}

            <div className="flex items-center gap-3">
              <button onClick={closeDelModal} className={`flex-1 rounded-xl border ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'} px-4 py-2.5 text-sm font-medium transition-all`}>Cancel</button>
              <button onClick={handleDeleteAccount} disabled={delLoading || delConfirm !== 'DELETE'}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {delLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
