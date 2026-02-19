import { useEffect, useState } from 'react'

export function useAudioWaveform(audioUrl: string | null, numSamples = 300) {
  const [waveform, setWaveform] = useState<Float32Array | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!audioUrl) {
      setWaveform(null)
      return
    }

    let cancelled = false
    let audioCtx: AudioContext | null = null

    async function decode() {
      if (!audioUrl) return
      setLoading(true)
      try {
        audioCtx = new AudioContext()
        const response = await fetch(audioUrl)
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

        if (cancelled) return

        // Mix all channels down to mono
        const numChannels = audioBuffer.numberOfChannels
        const length = audioBuffer.length
        const mono = new Float32Array(length)
        for (let c = 0; c < numChannels; c++) {
          const channel = audioBuffer.getChannelData(c)
          for (let i = 0; i < length; i++) {
            mono[i] += channel[i] / numChannels
          }
        }

        // Downsample to numSamples RMS blocks
        const blockSize = Math.floor(length / numSamples)
        const samples = new Float32Array(numSamples)
        for (let i = 0; i < numSamples; i++) {
          let sum = 0
          const start = i * blockSize
          for (let j = 0; j < blockSize; j++) {
            const v = mono[start + j] ?? 0
            sum += v * v
          }
          samples[i] = Math.sqrt(sum / blockSize)
        }

        setWaveform(samples)
      } catch {
        if (!cancelled) setWaveform(null)
      } finally {
        if (!cancelled) setLoading(false)
        audioCtx?.close()
      }
    }

    decode()

    return () => {
      cancelled = true
      audioCtx?.close()
    }
  }, [audioUrl, numSamples])

  return { waveform, loading }
}
