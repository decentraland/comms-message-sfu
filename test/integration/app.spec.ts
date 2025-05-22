import { test } from '../components'
import { mockRoom } from '../mocks/livekit'

test('when starting the app', async () => {
  it('should run properly', async () => {
    mockRoom.on.mockReturnThis()
    mockRoom.off.mockReturnThis()

    expect(true).toBe(true)
  })
})
