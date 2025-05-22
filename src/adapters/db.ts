import SQL from 'sql-template-strings'
import { AppComponents } from '../types'

export type IDatabaseComponent = {
  getCommunityMembers: (communityId: string) => Promise<string[]>
}

export async function createDBComponent(components: Pick<AppComponents, 'pg' | 'logs'>): Promise<IDatabaseComponent> {
  const { pg, logs } = components
  const _logger = logs.getLogger('database')

  const getCommunityMembers = async (communityId: string) => {
    const result = await pg.query(
      SQL`SELECT LOWER(address) as address FROM community_members WHERE community_id = ${communityId}`
    )
    return result.rows.map((row) => row.address)
  }

  return { getCommunityMembers }
}
