import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button, Chip, ChipRow, SwitchRow } from './primitives'

function ControlledSwitch({ onChange }: { onChange: (on: boolean) => void }) {
  const [on, setOn] = useState(false)
  return (
    <SwitchRow
      label="Blue light phones"
      description="Emergency phones on campus"
      checked={on}
      onCheckedChange={(next) => {
        setOn(next)
        onChange(next)
      }}
    />
  )
}

describe('SwitchRow', () => {
  it('is a switch named by its label, toggled from anywhere on the row', () => {
    const onChange = vi.fn()
    render(<ControlledSwitch onChange={onChange} />)
    const sw = screen.getByRole('switch', { name: /blue light phones/i })
    expect(sw).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(screen.getByText('Emergency phones on campus'))
    expect(onChange).toHaveBeenLastCalledWith(true)
    expect(sw).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(sw)
    expect(onChange).toHaveBeenLastCalledWith(false)
  })
})

describe('Chip and ChipRow', () => {
  it('exposes pressed state and a named toolbar', () => {
    render(
      <ChipRow label="Categories">
        <Chip pressed>Food</Chip>
        <Chip pressed={false}>Study</Chip>
      </ChipRow>,
    )
    expect(screen.getByRole('toolbar', { name: 'Categories' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Food' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Study' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('Button', () => {
  it('adds the keystone only to the brand action', () => {
    const { container } = render(
      <>
        <Button tone="brand">Start</Button>
        <Button>Cancel</Button>
      </>,
    )
    expect(container.querySelectorAll('[data-slot="keystone"]')).toHaveLength(1)
  })
})
