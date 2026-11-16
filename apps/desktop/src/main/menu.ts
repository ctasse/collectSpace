/** 中文应用菜单；保留编辑角色，避免影响输入框的复制粘贴。 */
import {
  app,
  Menu,
  shell,
  type MenuItemConstructorOptions,
} from "electron";

const REPO_URL = "https://github.com/ctasse/collectSpace";

export function installApplicationMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "文件",
      submenu: [
        {
          label: "打开数据目录",
          click: () => void shell.openPath(app.getPath("userData")),
        },
        { type: "separator" },
        { role: "quit", label: "退出" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "视图",
      submenu: [
        { role: "reload", label: "重新加载" },
        { role: "toggleDevTools", label: "开发者工具" },
        { type: "separator" },
        { role: "resetZoom", label: "实际大小" },
        { role: "zoomIn", label: "放大" },
        { role: "zoomOut", label: "缩小" },
        { type: "separator" },
        { role: "togglefullscreen", label: "全屏" },
      ],
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "项目主页",
          click: () => void shell.openExternal(REPO_URL),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
