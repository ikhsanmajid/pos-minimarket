import React from 'react'
import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface FieldTooltipProps {
    content: string
}

export function FieldTooltip({ content }: FieldTooltipProps) {
    return (
        <TooltipProvider delay={150}>
            <Tooltip>
                <TooltipTrigger
                    type="button"
                    tabIndex={-1}
                    className="inline-flex items-center justify-center text-muted-foreground/80 hover:text-foreground transition-colors cursor-help align-middle ml-1"
                    aria-label="Informasi field"
                >
                    <HelpCircle className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[260px] leading-relaxed">
                    {content}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
