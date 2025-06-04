import SQL from 'sql-template-strings'
import { AppComponents } from '../types'

export type IDatabaseComponent = {
  belongsToCommunity: (communityId: string, address: string) => Promise<boolean>
  getCommunityMembers: (
    communityId: string,
    options?: {
      include?: string[]
      exclude?: string[]
    }
  ) => Promise<string[]>
}

export async function createDBComponent(components: Pick<AppComponents, 'pg'>): Promise<IDatabaseComponent> {
  const { pg } = components

  const belongsToCommunity = async (communityId: string, address: string) => {
    const result = await pg.query(
      SQL`SELECT EXISTS(SELECT 1 FROM community_members WHERE community_id = ${communityId} AND member_address = ${address.toLowerCase()})`
    )
    return result.rows[0].exists ?? false
  }

  const getCommunityMembers = async (
    communityId: string,
    options?: {
      include?: string[]
      exclude?: string[]
    }
  ) => {
    const includeAddresses = options?.include?.map((address) => `'${address.toLowerCase()}'`)
    const excludeAddresses = options?.exclude?.map((address) => `'${address.toLowerCase()}'`)

    const query = SQL`
      SELECT LOWER(cm.member_address) as address FROM communities c
      LEFT JOIN community_members cm ON cm.community_id = c.id
      WHERE c.id = ${communityId} AND c.active = TRUE`

    if (includeAddresses) {
      query.append(` AND cm.member_address IN (${includeAddresses.join(',')})`)
    }

    if (excludeAddresses) {
      query.append(` AND cm.member_address NOT IN (${excludeAddresses.join(',')})`)
    }

    const result = await pg.query(query)
    return result.rows.map((row) => row.address)
  }

  return { belongsToCommunity, getCommunityMembers }
}
