import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button, Chip, ChipRow, SwitchRow } from './primitives'
afterEach(cleanup)
// jsdom has no layout: scrollIntoView is missing.
Element.prototype.scrollIntoView ??= () => {}

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

describe('ChipRow scrolling', () => {
  function row(onFood = vi.fn()) {
    render(
      <ChipRow label="Categories">
        <Chip pressed={false} onClick={onFood}>Food</Chip>
        <Chip pressed={false}>Study</Chip>
        <Chip pressed={false}>Parking</Chip>
      </ChipRow>,
    )
    return screen.getByRole('toolbar', { name: 'Categories' })
  }

  it('arrow keys, Home and End move focus between chips', () => {
    const bar = row()
    screen.getByRole('button', { name: 'Food' }).focus()
    fireEvent.keyDown(bar, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: 'Study' })).toHaveFocus()
    fireEvent.keyDown(bar, { key: 'End' })
    expect(screen.getByRole('button', { name: 'Parking' })).toHaveFocus()
    fireEvent.keyDown(bar, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: 'Parking' })).toHaveFocus()
    fireEvent.keyDown(bar, { key: 'Home' })
    expect(screen.getByRole('button', { name: 'Food' })).toHaveFocus()
  })

  it('a mouse drag past the threshold scrolls and does not press the chip; a plain click does', () => {
    const onFood = vi.fn()
    const bar = row(onFood)
    bar.setPointerCapture = vi.fn()
    bar.hasPointerCapture = vi.fn(() => true)
    bar.releasePointerCapture = vi.fn()
    const food = screen.getByRole('button', { name: 'Food' })

    fireEvent.pointerDown(food, { pointerType: 'mouse', pointerId: 1, button: 0, clientX: 100 })
    fireEvent.pointerMove(food, { pointerType: 'mouse', pointerId: 1, clientX: 60 })
    fireEvent.pointerUp(food, { pointerType: 'mouse', pointerId: 1, clientX: 60 })
    fireEvent.click(food)
    expect(onFood).not.toHaveBeenCalled()
    expect(bar.setPointerCapture).toHaveBeenCalled()

    fireEvent.pointerDown(food, { pointerType: 'mouse', pointerId: 2, button: 0, clientX: 100 })
    fireEvent.pointerMove(food, { pointerType: 'mouse', pointerId: 2, clientX: 102 })
    fireEvent.pointerUp(food, { pointerType: 'mouse', pointerId: 2, clientX: 102 })
    fireEvent.click(food)
    expect(onFood).toHaveBeenCalledTimes(1)
  })
})
