import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizePhoneNumber(value: string | null | undefined): string {
  if (!value) {
    return ''
  }

  let digits = value.replace(/\D+/g, '')

  if (!digits) {
    return ''
  }

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  if (digits.startsWith('54') && digits.length >= 5 && digits[2] === '0') {
    digits = '54' + digits.slice(3)
  }

  if (digits.startsWith('549') && digits.length >= 12) {
    digits = '54' + digits.slice(3)
  }

  if (!digits.startsWith('54') && digits.length >= 10) {
    digits = '54' + digits.replace(/^0+/, '')
  }

  return digits
}