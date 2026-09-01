import { useEffect, useState } from 'react'

/**
 * Atrasa a atualização de um valor.
 *
 * Uso: campo de busca. Sem isto, digitar "Maria" dispara 5 consultas ao banco
 * (uma por letra). Com 300ms de espera, dispara uma só, depois que a pessoa
 * para de digitar.
 *
 * O `return` do useEffect cancela o timer anterior a cada tecla — é essa
 * limpeza que faz o mecanismo funcionar.
 */
export function useDebounce<T>(valor: T, atrasoMs = 300): T {
  const [valorAdiado, setValorAdiado] = useState(valor)

  useEffect(() => {
    const timer = setTimeout(() => setValorAdiado(valor), atrasoMs)
    return () => clearTimeout(timer)
  }, [valor, atrasoMs])

  return valorAdiado
}
