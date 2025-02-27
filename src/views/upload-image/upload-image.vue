<template>
  <div class="upload-page-container">
    <!-- 左侧 / 上传图片列表 -->
    <div
      class="upload-page-left page-container"
      v-if="
        uploadImageList.length &&
        (userSettings.elementPlusSize === ElementPlusSizeEnum.large ||
          userSettings.elementPlusSize === ElementPlusSizeEnum.default)
      "
      :style="{
        width: '300rem'
      }"
    >
      <div class="uploaded-item" v-for="(item, index) in uploadImageList" :key="index + item.uuid">
        <upload-image-card :img-obj="item" @remove="remove($event)" />
      </div>
    </div>

    <!-- 右侧 / 上传操作 -->
    <div class="upload-page-right page-container" :class="{ 'has-left': uploadImageList.length }">
      <!-- 选择图片区域 -->
      <div class="row-item">
        <div class="content-box">
          <getting-images
            :disabled="uploading"
            ref="gettingImagesRef"
            @getImgList="setImgList"
          ></getting-images>
        </div>
      </div>

      <!-- 状态信息区域 -->
      <div class="row-item">
        <div class="content-box upload-area-status">
          <selected-info-bar />
          <div v-if="uploadImageList.length">
            已上传：{{ uploadImageList.filter((x) => x.uploadStatus.progress === 100).length }} /
            {{ uploadImageList.length }}
          </div>
        </div>
      </div>

      <!-- 重置 & 上传 -->
      <div class="row-item" v-if="uploadImageList.length">
        <div class="content-box" style="text-align: right">
          <el-button :disabled="uploading" plain type="warning" @click="resetUploadInfo">
            重置 <span class="shortcut-key">{{ shortcutKey }} + A</span>
          </el-button>
          <el-button :disabled="uploading" plain type="primary" @click="uploadImage">
            上传 <span class="shortcut-key">{{ shortcutKey }} + S</span>
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, watch, ref, Ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from '@/store'
import { ElementPlusSizeEnum, UploadImageModel, UploadStatusEnum } from '@/common/model'
import { batchCopyImageLinks, copyImageLink, getOSName } from '@/utils'
import { generateUploadImageObject, starred } from './upload-image.util'
import { uploadImagesToGitHub, uploadImageToGitHub } from '@/utils/upload-utils'
import UploadImageCard from './components/upload-image-card/upload-image-card.vue'

const store = useStore()
const router = useRouter()

const gettingImagesRef: Ref = ref<null | HTMLElement>(null)

const userConfigInfo = computed(() => store.getters.getUserConfigInfo).value
const userSettings = computed(() => store.getters.getUserSettings).value
const logoutStatus = computed(() => store.getters.getUserLoginStatus)

const uploadImageList = ref<UploadImageModel[]>([])
const uploading = ref(false)
const shortcutKey = computed(() => (getOSName() === 'mac' ? 'Command' : 'Ctrl'))

const setImgList = (imgList: any[]) => {
  imgList.forEach((v) => {
    store.dispatch('UPLOAD_IMG_LIST_ADD', generateUploadImageObject(v))
  })
}

// 重置选择图片的公共组件
const resetGettingImages = () => {
  gettingImagesRef.value?.reset()
}

// 上传图片的具体操作
// eslint-disable-next-line consistent-return
const doUploadImages = async (imgList: UploadImageModel[]) => {
  // 单张图片
  if (imgList.length === 1) {
    if (await uploadImageToGitHub(userConfigInfo, imgList[0])) {
      return UploadStatusEnum.uploaded
    }
    return UploadStatusEnum.uploadFail
  }

  // 多张图片
  if (imgList.length > 1) {
    if (await uploadImagesToGitHub(userConfigInfo, imgList)) {
      return UploadStatusEnum.allUploaded
    }
    return UploadStatusEnum.uploadFail
  }
}

// 上传
const uploadImage = async () => {
  const { token, selectedRepo, selectedDir } = userConfigInfo

  if (!token) {
    ElMessage.error('请先完成图床配置')
    await router.push('/config')
    return
  }

  if (!selectedRepo) {
    ElMessage.error('请选择一个仓库')
    await router.push('/config')
    return
  }

  if (!selectedDir) {
    ElMessage.error('目录不能为空')
    await router.push('/config')
    return
  }

  const notYetUploadList = uploadImageList.value.filter((x) => x.uploadStatus.progress === 0)

  if (notYetUploadList.length === 0) {
    ElMessage.error('请选择要上传的图片')
    return
  }

  uploading.value = true
  const uploadRes: UploadStatusEnum = (await doUploadImages(notYetUploadList)) as UploadStatusEnum
  uploading.value = false
  const uploadedImg = notYetUploadList
    .filter((v) => v.uploadStatus.progress === 100)
    .map((x: UploadImageModel) => x.uploadedImg!)
  // eslint-disable-next-line default-case
  switch (uploadRes) {
    // 单张图片上传成功
    case UploadStatusEnum.uploaded:
      resetGettingImages()
      ElMessage.success('图片上传成功')
      // 自动复制这张图片链接到系统剪贴板
      copyImageLink(uploadedImg[0], userConfigInfo, userSettings, true)
      await starred(userSettings)
      break

    // 多张图片上传成功
    case UploadStatusEnum.allUploaded:
      resetGettingImages()
      ElMessage.success('图片批量上传成功')
      // 自动复制这些图片链接到系统剪贴板
      batchCopyImageLinks(uploadedImg, userConfigInfo, userSettings, true)
      await starred(userSettings)
      break

    // 上传失败（网络错误等原因）
    case UploadStatusEnum.uploadFail:
      ElMessage.error('上传失败，请稍后重试！')
  }
}

// 重置
const resetUploadInfo = () => {
  uploading.value = false
  store.dispatch('UPLOAD_IMG_LIST_RESET')
  resetGettingImages()
}

// 删除
const remove = (uuid: string) => {
  store.dispatch('UPLOAD_IMG_LIST_REMOVE', uuid)
  gettingImagesRef.value?.remove(uuid)
}

watch(
  () => logoutStatus,
  (_n) => {
    // 如果退出登录，清空信息
    // eslint-disable-next-line no-unused-expressions
    !_n && resetUploadInfo()
  }
)

watch(
  () => store.state.uploadImageListModule.uploadImageList,
  (newValue) => {
    uploadImageList.value = newValue
  },
  {
    immediate: true,
    deep: true
  }
)

const registerShortcuts = () => {
  document.addEventListener('keydown', (e) => {
    const keyCode = e.keyCode || e.which || e.charCode
    const ctrlKey = e.ctrlKey || e.metaKey

    // 重置操作快捷组合键 Command + A
    if (ctrlKey && keyCode === 65) {
      if (uploadImageList.value.length) {
        resetUploadInfo()
        e.preventDefault()
      }
    }

    // 上传操作快捷组合键 Command + S
    if (ctrlKey && keyCode === 83) {
      if (!uploading.value) {
        uploadImage()
        e.preventDefault()
      }
    }
  })
}

onMounted(() => {
  registerShortcuts()
})
</script>

<style lang="stylus">
@import "./upload-image.styl"
</style>
