# Memory 模块设计说明

## 概述

Memory 模块负责记忆的存储和检索，采用混合存储策略：
- **SQLite 数据库**：用于带标签的记忆存储和搜索
- **Markdown 文件**：用于每日笔记和长期记忆
- 支持标签系统、模糊搜索和记忆上下文生成

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                   Memory Manager                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │  SQLite 存储                                      │  │
│  │  - store: 存储带标签的记忆                         │  │
│  │  - search: 内容搜索                                │  │
│  │  - getByTag: 标签查询                              │  │
│  │  - getRecent: 最近记忆                              │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Markdown 存储                                    │  │
│  │  - appendToday: 添加每日笔记                       │  │
│  │  - readToday: 读取今日笔记                         │  │
│  │  - writeLongTerm: 写入长期记忆                     │  │
│  │  - readLongTerm: 读取长期记忆                      │  │
│  │  - getMemoryContext: 获取记忆上下文                │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
   ┌─────────────┐              ┌─────────────┐
   │  SQLite    │              │  Markdown   │
   │  Database   │              │  Files      │
   └─────────────┘              └─────────────┘
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

### 8. 每日笔记 - 读取

```typescript
async readToday(): Promise<string>
```

- 读取今日笔记内容
- 如果文件不存在，返回空字符串

### 9. 每日笔记 - 添加

```typescript
async appendToday(content: string): Promise<void>
```

- 追加内容到今日笔记
- 如果文件不存在，自动创建并添加日期标题
- 格式：`# YYYY-MM-DD`

### 10. 长期记忆 - 读取

```typescript
async readLongTerm(): Promise<string>
```

- 读取长期记忆内容
- 如果文件不存在，返回空字符串

### 11. 长期记忆 - 写入

```typescript
async writeLongTerm(content: string): Promise<void>
```

- 写入长期记忆内容
- 覆盖现有内容

### 12. 记忆上下文

```typescript
async getMemoryContext(): Promise<string>
```

- 获取完整的记忆上下文
- 包含长期记忆和今日笔记
- 格式化为 Markdown，便于 LLM 理解

### 13. 最近记忆（天数）

```typescript
async getRecentMemories(days: number): Promise<Memory[]>
```

- 获取最近 N 天的记忆
- 按更新时间倒序排列

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

// SQLite 存储 - 存储记忆
const id = await memoryManager.store(
  '用户询问了如何使用文件工具',
  ['feishu', 'message', 'user-question']
)

// SQLite - 按 ID 查询
const memory = await memoryManager.getById(id)
console.log(memory?.content)

// SQLite - 内容搜索
const results = await memoryManager.search('文件工具')
results.forEach(m => console.log(m.content))

// SQLite - 标签查询
const feishuMemories = await memoryManager.getByTag('feishu')

// SQLite - 最近记忆
const recent = await memoryManager.getRecent(10)

// SQLite - 最近 N 天的记忆
const recentDays = await memoryManager.getRecentMemories(7)

// SQLite - 更新记忆
await memoryManager.update(id, undefined, ['feishu', 'updated'])

// SQLite - 删除记忆
await memoryManager.delete(id)

// Markdown - 每日笔记
await memoryManager.appendToday('用户询问了 TypeScript 相关问题')
const todayNotes = await memoryManager.readToday()
console.log('今日笔记:', todayNotes)

// Markdown - 长期记忆
await memoryManager.writeLongTerm('用户是一名开发者，擅长 TypeScript 和 Python')
const longTerm = await memoryManager.readLongTerm()
console.log('长期记忆:', longTerm)

// Markdown - 获取记忆上下文
const context = await memoryManager.getMemoryContext()
console.log('记忆上下文:', context)

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

1. **混合存储策略**：SQLite 用于结构化数据和搜索，Markdown 用于可读性强的笔记
2. **高效查询**：利用 SQLite 的索引和查询优化
3. **事务支持**：保证数据一致性
4. **易于扩展**：预留嵌入向量字段，支持未来的语义搜索
5. **标签系统**：灵活的分类和检索机制
6. **可读性**：Markdown 格式便于人工查看和编辑
7. **上下文生成**：自动为 LLM 生成结构化的记忆上下文

## 存储策略

### SQLite 存储

**适用场景**：
- 需要快速检索的记忆
- 带标签的分类记忆
- 需要模糊搜索的内容
- 临时性、碎片化的信息

**优势**：
- 查询性能优秀
- 支持复杂的查询条件
- 适合大量数据

### Markdown 存储

**适用场景**：
- 每日笔记和日志
- 长期记忆和重要信息
- 需要人工查看和编辑的内容
- 结构化的上下文信息

**优势**：
- 人类可读性强
- 易于版本控制
- 便于 LLM 理解

### 记忆上下文生成

`getMemoryContext()` 方法将不同来源的记忆整合成一个结构化的 Markdown 文档：

```markdown
## Long-term Memory
[长期记忆内容]

## Today's Notes
[今日笔记内容]
```

这种格式便于 LLM 理解和使用记忆信息。

## 与 nanobot 的对比

| 特性 | nanobot (文本文件) | minibot (混合存储) |
|------|-------------------|------------------|
| 存储格式 | JSONL | SQLite + Markdown |
| 查询能力 | 需要读取文件 | SQL 查询 |
| 每日笔记 | 无 | Markdown 文件 |
| 长期记忆 | 无 | Markdown 文件 |
| 记忆上下文 | 无 | 自动生成 |
| 性能 | 小数据量够用 | 大数据量更优 |
| 调试性 | 易于查看和编辑 | 易于查看和编辑 |
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
