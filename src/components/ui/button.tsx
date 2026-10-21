import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { type ButtonVariantProps, buttonVariants } from './button-variants'

export type ButtonProps = ComponentProps<'button'> & ButtonVariantProps

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
