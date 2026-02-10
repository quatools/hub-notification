import { ChannelList } from "@/components/channels/channel-list"

export default function ChannelsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Mes canaux de notification</h1>
      <ChannelList />
    </div>
  )
}
