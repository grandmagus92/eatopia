// utils/auth.ts
export const ADMIN_CREDENTIALS = {
  username: 'eatopia888',
  password: '888eatopia'
}

export const verifyAdmin = (username: string, password: string): boolean => {
  console.log('Input:', { username, password }) // Debug log
  console.log('Expected:', ADMIN_CREDENTIALS) // Debug log
  
  const isValid = username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password
  console.log('Is valid:', isValid) // Debug log
  
  return isValid
}

export const isAuthenticated = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('adminAuth') === 'true'
  }
  return false
}

export const logout = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('adminAuth')
    window.location.href = '/login'
  }
}