import { useState, useEffect } from 'react'
import { MODEL_CATALOGUE } from '@agenthub/types'

export type ModelEntry = {
  provider: string
  id: string
  label: string
  tier: string
}

export function useModelCatalogue() {
  const [models, setModels] = useState<ModelEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('customModels')
      if (stored) {
        try {
          setModels(JSON.parse(stored))
        } catch (err) {
          setModels([...MODEL_CATALOGUE])
        }
      } else {
        setModels([...MODEL_CATALOGUE])
      }
      setLoaded(true)
    }
  }, [])

  const saveModels = (newModels: ModelEntry[]) => {
    setModels(newModels)
    localStorage.setItem('customModels', JSON.stringify(newModels))
  }

  return { models, saveModels, loaded }
}
