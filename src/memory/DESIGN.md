# Memory 模块设计说明

## 概述

Memory 模块负责记忆的存储和检索，使用 SQLite 数据库实现持久化存储，支持标签系统和模糊搜索。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                   Memory Manager                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  存储操作                                       │  │
│  │  - store: 存储记忆                               │  │
│  │  - update: 更新记忆                               │  │
│  │  - delete: 删除记忆                               │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  检索操作                                       │  │
│  │  - getById: 按 ID 查询                           │  │
│  │  - search: 内容搜索                               │  │
│  │  - getByTag: 标签查询                             │  │
│  │  - getRecent: 最近记忆                             │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │  SQLite    │
                       │  Database   │
                       └─────────────┘
```

## 数据库结构

```sql
CREATE TABLE memory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  embedding BLOB,
  tags TEXT NOT NULL DEFAULT '[]',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
)
```

### 字段说明

- `id`: 记忆唯一标识
- `content`: 记忆内容（文本）
- `embedding`: 嵌入向量（为未来的语义搜索预留）
- `tags`: 标签列表（JSON 格式）
- `createdAt`: 创建时间（Unix 时间戳）
- `updatedAt`: 更新时间（Unix 时间戳）

## 核心功能

### 1. 存储记忆

```typescript
async store(content: string, tags: string[] = [], embedding?: number[]): Promise<number>
```

- 存储文本内容
- 可选的嵌入向量（为未来的语义搜索预留）
- 标签系统（用于分类和检索）
- 自动记录创建和更新时间

### 2. 按 ID 查询

```typescript
async getById(id: number): Promise<Memory | null>
```

- 根据记忆 ID 获取完整记录
- 返回 null 如果不存在

### 3. 内容搜索

```typescript
async search(query: string, limit: number = 10): Promise<Memory[]>
```

- 使用 `LIKE` 进行模糊匹配
- 按更新时间倒序排列
- 支持限制结果数量

### 4. 标签查询

```typescript
async getByTag(tag: string, limit: number = 10): Promise<Memory[]>
```

- 根据标签筛选记忆
- 支持部分匹配
- 按更新时间倒序排列

### 5. 最近记忆

```typescript
async getRecent(limit: number = 10): Promise<Memory[]>
```

- 获取最近添加的记忆
- 按更新时间倒序排列

### 6. 更新记忆

```typescript
async update(id: number, content?: string, tags?: string[]): Promise<void>
```

- 更新内容和标签
- 自动更新时间戳

### 7. 删除记忆

```typescript
async delete(id: number): Promise<void>
```

- 根据 ID 删除记忆

## 数据结构

```typescript
interface Memory {
  id: number
  content: string
  embedding?: number[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
}
```

## 使用示例

```typescript
import { getMemoryManager } from './memory/manager'

const memoryManager = getMemoryManager()

// 存储记忆
const id = await memoryManager.store(
  '用户询问了如何使用文件工具',
  ['feishu', 'message', 'user-question']
)

// 按 ID 查询
const memory = await memoryManager.getById(id)
console.log(memory?.content)

// 内容搜索
const results = await memoryManager.search('文件工具')
results.forEach(m => console.log(m.content))

// 标签查询
const feishuMemories = await memoryManager.getByTag('feishu')

// 最近记忆
const recent = await memoryManager.getRecent(10)

// 更新记忆
await memoryManager.update(id, undefined, ['feishu', 'updated'])

// 删除记忆
await memoryManager.delete(id)

// 关闭
await memoryManager.close()
```

## 当前使用场景

在飞书消息处理中，用于存储消息记录：

```typescript
await memoryManager.store(
  JSON.stringify({ userId, content, messageId }),
  ['feishu', 'message', messageId]
)
```

## 设计原则

1. **持久化存储**：使用 SQLite 确保数据不丢失
2. **高效查询**：利用 SQLite 的索引和查询优化
3. **事务支持**：保证数据一致性
4. **易于扩展**：预留嵌入向量字段，支持未来的语义搜索
5. **标签系统**：灵活的分类和检索机制

## 与 nanobot 的对比

| 特性 | nanobot (文本文件) | minibot (SQLite) |
|------|-------------------|------------------|
| 存储格式 | JSONL | SQLite 表 |
| 查询能力 | 需要读取文件 | SQL 查询 |
| 性能 | 小数据量够用 | 大数据量更优 |
| 调试性 | 易于查看和编辑 | 需要工具查看 |
| 扩展性 | 有限 | 良好 |

## 优势

1. **性能**：SQLite 的查询性能优秀，适合大量数据
2. **可靠性**：事务支持保证数据一致性
3. **扩展性**：预留嵌入向量字段，支持未来的语义搜索
4. **灵活性**：标签系统支持多种查询方式
5. **持久化**：数据不会因为程序重启而丢失

## 未来扩展

- 语义搜索（使用嵌入向量）
- 记忆关联和推荐
- 记忆过期和清理
- 记忆统计和分析
- 记忆导入/导出
- 多种查询方式（全文搜索、向量搜索等）
