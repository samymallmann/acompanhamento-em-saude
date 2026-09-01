/**
 * Junta classes CSS, ignorando false/null/undefined.
 *
 * Permite escrever:
 *   cn('rounded p-2', ativo && 'bg-marca-600', className)
 *
 * Sem dependência externa de propósito: `clsx` e `tailwind-merge` resolvem
 * também conflito entre utilitários (p-2 vs p-4), problema que este projeto
 * ainda não tem. Se um dia tiver, trocar aqui não afeta o resto do código.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}
