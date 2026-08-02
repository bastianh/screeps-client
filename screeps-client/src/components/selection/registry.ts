// Maps object types to their detail components; DefaultDetails renders everything else.
import type { JSX } from 'solid-js'
import type { SelectedObject } from '~/stores/selectionStore.js'
import { DefaultDetails } from './DefaultDetails.js'
import { CreepDetails } from './CreepDetails.js'
import { FlagDetails } from './FlagDetails.js'
import { ControllerDetails } from './ControllerDetails.js'
import { ExtensionDetails } from './ExtensionDetails.js'
import { StoreStructureDetails } from './StoreStructureDetails.js'
import { PowerBankDetails } from './PowerBankDetails.js'
import { RuinDetails } from './RuinDetails.js'
import { PortalDetails } from './PortalDetails.js'

export { DefaultDetails }

export const CUSTOM_DETAILS: Record<string, (props: { item: SelectedObject }) => JSX.Element> = {
  creep: CreepDetails,
  flag: FlagDetails,
  controller: ControllerDetails,
  spawn: ExtensionDetails,
  extension: ExtensionDetails,
  tower: ExtensionDetails,
  link: ExtensionDetails,
  storage: StoreStructureDetails,
  terminal: StoreStructureDetails,
  container: StoreStructureDetails,
  lab: StoreStructureDetails,
  factory: StoreStructureDetails,
  nuker: StoreStructureDetails,
  powerSpawn: StoreStructureDetails,
  powerBank: PowerBankDetails,
  ruin: RuinDetails,
  portal: PortalDetails,
}
