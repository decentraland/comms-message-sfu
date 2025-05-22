import SQL from 'sql-template-strings'
import { AppComponents } from '../types'

export type IDatabaseComponent = {
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

  const getCommunityMembers = async (
    communityId: string,
    options?: {
      include?: string[]
      exclude?: string[]
    }
  ) => {
    const includeAddresses = options?.include?.map((address) => `'${address}'`)
    const excludeAddresses = options?.exclude?.map((address) => `'${address}'`)

    const query = SQL`
      SELECT LOWER(cm.address) as address FROM community_members cm
        WHERE cm.community_id = ${communityId}`

    if (includeAddresses) {
      query.append(` AND cm.address IN (${includeAddresses.join(',')})`)
    }

    if (excludeAddresses) {
      query.append(` AND cm.address NOT IN (${excludeAddresses.join(',')})`)
    }

    // TODO: Filter kicked and banned addresses

    const result = await pg.query(query)
    return result.rows.map((row) => row.address)
  }

  return { getCommunityMembers }
}
