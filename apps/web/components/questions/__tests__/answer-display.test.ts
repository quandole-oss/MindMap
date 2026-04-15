import { describe, it, expect } from 'vitest'
import { extractSocraticFollowUp } from '../extract-socratic-follow-up'

describe('extractSocraticFollowUp', () => {
  // 1. Empty string
  it('returns body as empty string and followUp null for empty input', () => {
    const result = extractSocraticFollowUp('')
    expect(result).toEqual({ body: '', followUp: null })
  })

  // 2. Single paragraph, no question
  it('returns the full text as body with no followUp when there is no question', () => {
    const text = 'Photosynthesis converts sunlight into energy.'
    const result = extractSocraticFollowUp(text)
    expect(result).toEqual({ body: text, followUp: null })
  })

  // 3. Single paragraph that IS a question
  it('returns empty body and the question as followUp for a single-paragraph question', () => {
    const text = 'What do you think happens next?'
    const result = extractSocraticFollowUp(text)
    expect(result).toEqual({ body: '', followUp: text })
  })

  // 4. Multiple paragraphs, last is a question
  it('splits body and followUp when last paragraph ends with ?', () => {
    const text = 'Plants use chlorophyll to absorb light.\n\nThis energy drives the Calvin cycle.\n\nWhy do you think leaves are green?'
    const result = extractSocraticFollowUp(text)
    expect(result).toEqual({
      body: 'Plants use chlorophyll to absorb light.\n\nThis energy drives the Calvin cycle.',
      followUp: 'Why do you think leaves are green?',
    })
  })

  // 5. Multiple paragraphs, last is NOT a question
  it('returns full text as body when last paragraph does not end with ?', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph with a statement.'
    const result = extractSocraticFollowUp(text)
    expect(result).toEqual({ body: text, followUp: null })
  })

  // 6. Triple+ newlines still split correctly
  it('handles triple or more newlines as paragraph separators', () => {
    const text = 'Introduction.\n\n\n\nConclusion question?'
    const result = extractSocraticFollowUp(text)
    expect(result).toEqual({
      body: 'Introduction.',
      followUp: 'Conclusion question?',
    })
  })

  // 7. Whitespace-only paragraphs are filtered out
  it('filters out whitespace-only paragraphs between content', () => {
    const text = 'Real content.\n\n   \n\nIs this filtered correctly?'
    const result = extractSocraticFollowUp(text)
    expect(result).toEqual({
      body: 'Real content.',
      followUp: 'Is this filtered correctly?',
    })
  })

  // 8. Question mark in middle of text but not at end
  it('does not extract followUp when ? appears mid-text but not at the end', () => {
    const text = 'First part.\n\nIs this a question? No, it continues here.'
    const result = extractSocraticFollowUp(text)
    expect(result).toEqual({ body: text, followUp: null })
  })

  // 9. Real-world example: long answer with Socratic follow-up
  it('handles a realistic LLM answer with a Socratic follow-up at the end', () => {
    const text = [
      'Gravity is a fundamental force that attracts objects with mass toward each other. On Earth, it gives weight to physical objects and causes them to fall toward the ground when dropped.',
      'The strength of gravity depends on two things: the mass of the objects and the distance between them. This is described by Newton\'s law of universal gravitation.',
      'Interestingly, gravity is actually the weakest of the four fundamental forces, yet it dominates at large scales because it always attracts and has infinite range.',
      'Think about this: Why do you think astronauts float in the International Space Station even though they are only about 400 km above Earth?',
    ].join('\n\n')

    const result = extractSocraticFollowUp(text)

    expect(result.followUp).toBe(
      'Think about this: Why do you think astronauts float in the International Space Station even though they are only about 400 km above Earth?'
    )
    expect(result.body).not.toContain('Think about this')
    expect(result.body).toContain('Gravity is a fundamental force')
    expect(result.body).toContain('weakest of the four fundamental forces')
  })
})
