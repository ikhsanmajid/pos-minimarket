import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { Link } from "@inertiajs/react"
import { ChevronRightIcon } from "lucide-react"
import { useState } from "react"

export function NavMain({
  items, currentPath
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[],
  currentPath: string
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Navigasi</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const itemsCount = item.items?.length ?? 0;

          if (itemsCount == 0) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton isActive={item.url == currentPath} tooltip={item.title} render={<Link href={item.url} />}>
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          }

          if (itemsCount > 0) {
            return (
              <Collapsible
                key={item.title}
                defaultOpen={item.isActive}
                className="group/collapsible"
                render={<SidebarMenuItem />}
              >
                <CollapsibleTrigger
                  render={<SidebarMenuButton tooltip={item.title} />}
                >
                  {item.icon}
                  <span>{item.title}</span>
                  <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton isActive={subItem.url !== "#" ? subItem.url == currentPath : false} render={<Link href={subItem.url} />}>
                          <span>{subItem.title}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </Collapsible>
            )
          }
        })}

      </SidebarMenu>


    </SidebarGroup >
  )
}
