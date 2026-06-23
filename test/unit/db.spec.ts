import { IPgComponent } from '@dcl/pg-component'
import { createDBComponent, IDatabaseComponent } from '../../src/adapters/db'
import { createTestPgComponent } from '../mocks/components'

describe('when handling database component', () => {
  let db: IDatabaseComponent
  let mockPg: jest.Mocked<IPgComponent>

  beforeEach(async () => {
    mockPg = createTestPgComponent()
    db = await createDBComponent({ pg: mockPg })
  })

  describe('when getting community members', () => {
    it('should return all members for a community', async () => {
      const communityId = 'test-community'
      const mockRows = [{ address: '0x123' }, { address: '0x456' }, { address: '0x789' }]

      mockPg.query.mockResolvedValueOnce({ rows: mockRows, rowCount: mockRows.length, notices: [] })

      const members = await db.getCommunityMembers(communityId)

      expect(mockPg.query).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('SELECT LOWER(cm.member_address) as address FROM communities c'),
          values: [communityId]
        })
      )
      expect(members).toEqual(['0x123', '0x456', '0x789'])
    })

    it('should filter members by include list', async () => {
      const communityId = 'test-community'
      const include = ['0x123', '0x456']
      const mockRows = [{ address: '0x123' }, { address: '0x456' }]

      mockPg.query.mockResolvedValueOnce({ rows: mockRows, rowCount: mockRows.length, notices: [] })

      const members = await db.getCommunityMembers(communityId, { include })

      expect(mockPg.query).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('AND cm.member_address = ANY('),
          values: [communityId, ['0x123', '0x456']]
        })
      )
      expect(members).toEqual(['0x123', '0x456'])
    })

    it('should filter members by exclude list', async () => {
      const communityId = 'test-community'
      const exclude = ['0x789']
      const mockRows = [{ address: '0x123' }, { address: '0x456' }]

      mockPg.query.mockResolvedValueOnce({ rows: mockRows, rowCount: mockRows.length, notices: [] })

      const members = await db.getCommunityMembers(communityId, { exclude })

      expect(mockPg.query).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('AND cm.member_address <> ALL('),
          values: [communityId, ['0x789']]
        })
      )
      expect(members).toEqual(['0x123', '0x456'])
    })

    it('should filter members by both include and exclude lists', async () => {
      const communityId = 'test-community'
      const include = ['0x123', '0x456']
      const exclude = ['0x789']
      const mockRows = [{ address: '0x123' }, { address: '0x456' }]

      mockPg.query.mockResolvedValueOnce({ rows: mockRows, rowCount: mockRows.length, notices: [] })

      const members = await db.getCommunityMembers(communityId, { include, exclude })

      const queryCall = mockPg.query.mock.calls[0][0]
      expect(queryCall.text).toContain('AND cm.member_address = ANY(')
      expect(queryCall.text).toContain('AND cm.member_address <> ALL(')
      expect(queryCall.values).toEqual([communityId, include, exclude])
      expect(members).toEqual(['0x123', '0x456'])
    })

    it('should handle empty result set', async () => {
      const communityId = 'test-community'
      mockPg.query.mockResolvedValueOnce({ rows: [], rowCount: 0, notices: [] })

      const members = await db.getCommunityMembers(communityId)
      expect(members).toEqual([])
    })

    it('should handle database errors', async () => {
      const communityId = 'test-community'
      const error = new Error('Database error')
      mockPg.query.mockRejectedValueOnce(error)

      await expect(db.getCommunityMembers(communityId)).rejects.toThrow('Database error')
    })
  })
})
