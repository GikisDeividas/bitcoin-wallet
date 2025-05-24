"use client"

import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

interface SettingsModalProps {
  show: boolean
  onClose: () => void
  onClearData?: () => void
}

export default function SettingsModal({ show, onClose, onClearData }: SettingsModalProps) {
  if (!show) return null

  const settingSections = [
    {
      title: "Currency",
      items: [
        { label: "USD", type: "button" },
        { label: "EUR", type: "button" },
        { label: "GBP", type: "button" },
      ],
    },
    {
      title: "Security",
      items: [
        { label: "Face ID/Touch ID", type: "toggle", value: "On" },
        { label: "PIN", type: "toggle", value: "Off" },
      ],
    },
    {
      title: "Notifications",
      items: [
        { label: "Price alerts", type: "toggle", value: "On" },
        { label: "Transaction alerts", type: "toggle", value: "Off" },
      ],
    },
    {
      title: "Network",
      items: [
        { label: "Mainnet", type: "button" },
        { label: "Testnet", type: "button" },
      ],
    },
    {
      title: "About",
      items: [
        { label: "App version", type: "button" },
        { label: "Terms of service", type: "button" },
        { label: "Privacy policy", type: "button" },
      ],
    },
    {
      title: "Data",
      items: [
        { label: "Clear all data", type: "button", action: "clear" },
      ],
    },
  ]

  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-white rounded-t-3xl p-4 w-full max-h-[75vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
          <Button variant="ghost" size="icon" className="rounded-full w-8 h-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-6">
          {settingSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-medium text-gray-900 mb-3">{section.title}</h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.label}>
                    {item.type === "button" ? (
                      <Button 
                        variant="outline" 
                        className={`w-full justify-start rounded-lg h-11 text-sm ${
                          'action' in item && item.action === 'clear' 
                            ? 'text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300' 
                            : ''
                        }`}
                        onClick={() => {
                          if ('action' in item && item.action === 'clear' && onClearData) {
                            if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
                              onClearData()
                            }
                          }
                        }}
                      >
                        {item.label}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                        <div className="text-sm text-gray-700">{item.label}</div>
                        <div className="text-sm font-medium text-gray-900">
                          {'value' in item ? item.value : ''}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
