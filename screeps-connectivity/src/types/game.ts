export interface RoomMap2Data {
    w?: [number, number][] | null    // player-built walls / ramparts
    r?: [number, number][] | null    // roads
    pb?: [number, number][] | null   // power banks / power
    p?: [number, number][] | null    // portals
    s?: [number, number][] | null    // sources
    c?: [number, number][] | null    // controllers
    m?: [number, number][] | null    // minerals
    k?: [number, number][] | null    // source keeper lairs
    d?: [number, number][] | null    // deposits (highway commodity resource)
    [userId: string]: [number, number][] | null | undefined  // structures + creeps for that user
}

export enum TerrainType {
    Plain = 0,
    Wall = 1,
    Swamp = 2,
}

export class RoomTerrain {
    readonly raw: Uint8Array

    constructor(data: Uint8Array) {
        this.raw = data
    }

    static fromEncodedString(encoded: string): RoomTerrain {
        const data = new Uint8Array(2500)
        for (let i = 0; i < 2500; i++) {
            const v = parseInt(encoded[i], 10)
            data[i] = v === 3 ? TerrainType.Wall : (v as TerrainType)
        }
        return new RoomTerrain(data)
    }

    get(x: number, y: number): TerrainType {
        return this.raw[y * 50 + x] as TerrainType
    }
}

export interface Badge {
    type: number | { path1: string; path2: string }
    color1: string | number
    color2: string | number
    color3: string | number
    param?: number
    flip: boolean
}

export interface RoomObject {
    _id: string
    type: string
    room: string
    x: number
    y: number

    [key: string]: unknown
}

export type RoomObjectMap = Record<string, RoomObject>
export type RoomObjectDiff = Record<string, Partial<RoomObject> | null>

export interface NotifyPrefs {
    disabled: boolean
    disabledOnMessages: boolean
    sendOnline: boolean
    interval: number
    errorsInterval: number
}

export interface UserInfo {
    _id: string
    username: string
    email: string
    cpu: number
    gcl: number
    /** Raw accumulated power points; Global Power Level derives from this. Absent on servers without the power system. */
    power?: number
    credits: number
    badge: Badge
    /** True when the account has a password set. Absent for password-less accounts (e.g. Steam-only logins). Only present for the authenticated user's own info. */
    password?: boolean
    notifyPrefs?: Partial<NotifyPrefs>
}

export interface CpuStats {
    cpu: number
    memory: number
}

export type WorldStatus = 'normal' | 'lost' | 'empty'


export interface ConsoleMessage {
    log: string[]
    results: string[]
    error: string[]
}

export interface ServerFeature {
    name: string
    version?: string | number
}

export interface ScreepsmodAuthFeature extends ServerFeature {
    name: 'screepsmod-auth'
    version: string
    authTypes: Array<'password' | 'steam' | 'github' | 'gitlab' | string>
    menuData?: Array<{
        section: number
        start: number
        item: { label: string; href: string }
    }>
}

/**
 * Published by `xxscreeps-mod-client` at `/api/version`, reflecting the
 * `backend` settings from the server's `.screepsrc.yaml`.
 */
export interface XxscreepsModClientFeature extends ServerFeature {
    name: 'xxscreeps-mod-client'
    version: number
    allowGuestAccess: boolean
    allowEmailRegistration: boolean
    steamLogin: boolean
}

export interface ServerVersion {
    ok: number
    package: number
    protocol: number
    useNativeAuth?: boolean
    users: number
    serverData: {
        historyChunkSize: number
        features: ServerFeature[]
        shards: Array<string | null>
        welcomeText?: string
        socketUpdateThrottle?: number
        customObjectTypes?: unknown
        renderer?: unknown
    }
}

export interface ShardInfo {
    name: string
    lastTicks: number[]
    cpuLimit: number
    rooms: number
    users: number
    tick: number
}

export interface WorldInfo {
    shard: string | null
    width: number
    height: number
    // Inclusive coordinate bounds of valid rooms.
    // Uses the internal system where W0 = x = -1, E0 = x = 0, N0 = y = -1, S0 = y = 0.
    minX: number
    maxX: number
    minY: number
    maxY: number
}

export interface VisualStyle {
    opacity?: number
    fill?: string
    stroke?: string
    strokeWidth?: number
    color?: string
    backgroundColor?: string
    backgroundPadding?: number
    align?: 'center' | 'left' | 'right'
    lineStyle?: 'dashed' | 'dotted' | 'solid'
    width?: number
    radius?: number
    font?: string | number
    fontSize?: number
    fontFamily?: string
    fontStyle?: string
    fontVariant?: string
}

export type RoomVisualEntry =
    | { t: 't'; x: number; y: number; text: string; s: VisualStyle }
    | { t: 'c'; x: number; y: number; s: VisualStyle }
    | { t: 'r'; x: number; y: number; w: number; h: number; s: VisualStyle }
    | { t: 'p'; points: [number, number][]; s: VisualStyle }
    | { t: 'l'; x1: number; y1: number; x2: number; y2: number; s: VisualStyle }

export type MapVisualEntry =
    | { t: 't'; n: string; x: number; y: number; text: string; s: VisualStyle }
    | { t: 'c'; n: string; x: number; y: number; s: VisualStyle }
    | { t: 'r'; n: string; x: number; y: number; w: number; h: number; s: VisualStyle }
    | { t: 'p'; points: Array<{ n: string; x: number; y: number }>; s: VisualStyle }
    | { t: 'l'; n1: string; x1: number; y1: number; n2: string; x2: number; y2: number; s: VisualStyle }
