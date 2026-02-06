import { Link, useNavigate, useLocation } from 'react-router-dom'
import { getAccessToken, clearAuthTokens, userLogoutAPI } from '@/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const isLoggedIn = !!getAccessToken()

  const handleLogout = async () => {
    let logoutByServerSucceeded = false
    try {
      await userLogoutAPI()
      logoutByServerSucceeded = true
    } catch {
      // 网络错误或 token 已过期时仍清除本地并跳转
    } finally {
      clearAuthTokens()
      if (logoutByServerSucceeded) {
        toast.success('Signed out successfully.')
      } else {
        toast.success('Signed out.')
      }
      navigate('/login', { replace: true })
    }
  }

  const isActive = (path: string) => location.pathname === path

  const navLinkClasses = (path: string) =>
    cn(
      'relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer',
      isActive(path)
        ? 'text-violet-600 bg-violet-100'
        : 'text-gray-700 hover:text-violet-600 hover:bg-violet-50'
    )

  return (
    <header className="fixed top-4 left-4 right-4 z-50">
      <nav className="glass mx-auto max-w-6xl rounded-2xl px-6 py-3">
        <div className="flex items-center justify-between">
          {/* Logo & Brand */}
          <Link
            to="/"
            className="flex items-center gap-2 text-xl font-bold text-gray-900 transition-opacity hover:opacity-80"
          >
            <svg
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">UCDSE</span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            <Link to="/news" className={navLinkClasses('/news')}>
              News
            </Link>
          </div>

          {/* Auth Actions */}
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <>
                <Link
                  to="/profile"
                  className={cn(
                    navLinkClasses('/profile'),
                    'flex items-center gap-2'
                  )}
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span className="hidden sm:inline">Profile</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ml-2 rounded-lg border border-gray-300 bg-white/60 px-4 py-2 text-sm font-medium text-gray-700 transition-all duration-200 hover:bg-gray-900 hover:text-white hover:border-gray-900 cursor-pointer"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="relative px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer text-gray-700 hover:text-violet-600 hover:bg-violet-50"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="ml-2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg transition-all duration-200 hover:opacity-90 cursor-pointer"
                  style={{ backgroundColor: '#4F46E5', color: '#ffffff' }}
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
